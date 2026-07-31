/**
 * Hook to decrypt messages locally.
 * Decryption happens client-side only — private keys never leave the device.
 *
 * Robust multi-device decryption:
 *  1. Try the message's primary ciphertext with every private key this browser
 *     holds for the signed-in user (current device key plus any older keys that
 *     are still in IndexedDB from earlier sessions/device rows).
 *  2. If none work, look up the per-device fan-out copies in
 *     `message_device_keys` for ALL of this user's known local device ids and
 *     try each of those with every local private key.
 *
 * This means both new and old devices can read messages as long as some key
 * material for the account exists on the device.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decryptMessage, initCrypto } from '@/lib/crypto';
import { useAuth } from '@/contexts/AuthContext';
import { getAllKeyPairs } from '@/lib/keyStore';
import { useDeviceKeys } from './useDeviceKeys';

// In-memory cache to avoid re-decrypting the same message
const decryptionCache = new Map<string, string>();

interface LocalKey {
  deviceId: string;
  privateKey: string;
}

export function useDecryptMessage() {
  const { user } = useAuth();
  const { deviceId, privateKey, loading: keysLoading, error: keysError } = useDeviceKeys();
  const initRef = useRef(false);
  const [localKeys, setLocalKeys] = useState<LocalKey[]>([]);

  // Load every keypair this browser has stored for the current user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setLocalKeys([]);
        return;
      }
      try {
        const stored = await getAllKeyPairs(user.id);
        if (!cancelled) {
          setLocalKeys(
            stored.map((k) => ({ deviceId: k.deviceId, privateKey: k.privateKey })),
          );
        }
      } catch {
        if (!cancelled) setLocalKeys([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, deviceId]);

  const decrypt = useCallback(async (
    messageId: string,
    ciphertext: string | null,
    nonce: string | null,
    aad: string | null,
    senderDevicePublicKey: string | null,
    isEncrypted: boolean
  ): Promise<string> => {
    // Not an encrypted message — return content as-is
    if (!isEncrypted || !ciphertext || !nonce || !aad) {
      return ''; // caller should use content field
    }

    // Check cache
    const cached = decryptionCache.get(messageId);
    if (cached) return cached;

    // Build the candidate key list: current device key first, then any other
    // keys this browser still holds for the account.
    const candidates: LocalKey[] = [];
    if (deviceId && privateKey) candidates.push({ deviceId, privateKey });
    for (const k of localKeys) {
      if (!candidates.some((c) => c.privateKey === k.privateKey)) candidates.push(k);
    }

    if (candidates.length === 0) {
      if (keysLoading) return '🔐 Setting up encryption on this device…';
      return keysError
        ? `🔒 Encryption setup failed: ${keysError}. Try refreshing the page.`
        : '🔒 Encryption not available on this device.';
    }
    if (!senderDevicePublicKey) {
      return '🔒 This message is missing its sender key and can\'t be read.';
    }

    try {
      if (!initRef.current) {
        await initCrypto();
        initRef.current = true;
      }

      let plaintext: string | null = null;

      // 1. Primary ciphertext against every local private key.
      for (const cand of candidates) {
        plaintext = await decryptMessage(
          ciphertext,
          nonce,
          aad,
          cand.privateKey,
          senderDevicePublicKey,
        );
        if (plaintext !== null) break;
      }

      // 2. Per-device fan-out copies for any of our known device ids. A new
      // message can arrive over Realtime just before its fan-out rows finish,
      // so briefly retry the lookup rather than permanently rendering failure.
      if (plaintext === null) {
        const deviceIds = candidates.map((c) => c.deviceId).filter(Boolean);
        if (deviceIds.length > 0) {
          for (let attempt = 0; attempt < 4 && plaintext === null; attempt += 1) {
            if (attempt > 0) {
              await new Promise((resolve) => setTimeout(resolve, attempt * 250));
            }
            const { data: fanouts } = await (supabase as any)
              .from('message_device_keys')
              .select('recipient_device_id, ciphertext, nonce, aad')
              .eq('message_id', messageId)
              .in('recipient_device_id', deviceIds);

            for (const row of fanouts ?? []) {
              if (!row?.ciphertext || !row?.nonce || !row?.aad) continue;
              for (const cand of candidates) {
                // Only use the private key belonging to the fan-out target.
                if (cand.deviceId !== row.recipient_device_id) continue;
                plaintext = await decryptMessage(
                  row.ciphertext,
                  row.nonce,
                  row.aad,
                  cand.privateKey,
                  senderDevicePublicKey,
                );
                if (plaintext !== null) break;
              }
              if (plaintext !== null) break;
            }
          }
        }
      }

      if (plaintext === null) {
        return '🔒 This message was encrypted before this device was added. Ask the sender to resend to see it here.';
      }

      // Cache the result
      decryptionCache.set(messageId, plaintext);
      return plaintext;
    } catch {
      return '🔒 This message can\'t be decrypted on this device.';
    }
  }, [deviceId, privateKey, localKeys, keysLoading, keysError]);

  const clearCache = useCallback(() => {
    decryptionCache.clear();
  }, []);

  return { decrypt, clearCache };
}
