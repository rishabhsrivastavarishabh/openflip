/**
 * Hook to decrypt messages locally.
 * Decryption happens client-side only — private keys never leave the device.
 *
 * Multi-device fallback: if the primary ciphertext was targeted at a device
 * other than this one, we look up a per-device copy in `message_device_keys`
 * and try that instead — so a signed-in device can read every message
 * sent to (or from) the current account.
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decryptMessage, initCrypto } from '@/lib/crypto';
import { useDeviceKeys } from './useDeviceKeys';

// In-memory cache to avoid re-decrypting the same message
const decryptionCache = new Map<string, string>();

export function useDecryptMessage() {
  const { deviceId, privateKey, loading: keysLoading, error: keysError } = useDeviceKeys();
  const initRef = useRef(false);

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

    if (keysLoading) {
      return '🔐 Setting up encryption on this device…';
    }
    if (!privateKey) {
      return keysError
        ? `🔒 Encryption setup failed: ${keysError}. Try refreshing the page.`
        : '🔒 Encryption not available on this device.';
    }
    if (!senderDevicePublicKey) {
      return '🔒 This message was sent to a different device and can\'t be read here.';
    }

    try {
      if (!initRef.current) {
        await initCrypto();
        initRef.current = true;
      }

      // First try: primary ciphertext on the message row itself.
      let plaintext = await decryptMessage(
        ciphertext,
        nonce,
        aad,
        privateKey,
        senderDevicePublicKey,
      );

      // Fallback: this device wasn't the primary target. Look up the
      // per-device copy created by the sender's fan-out.
      if (plaintext === null && deviceId) {
        const { data: fanout } = await (supabase as any)
          .from('message_device_keys')
          .select('ciphertext, nonce, aad')
          .eq('message_id', messageId)
          .eq('recipient_device_id', deviceId)
          .maybeSingle();
        if (fanout?.ciphertext && fanout?.nonce && fanout?.aad) {
          plaintext = await decryptMessage(
            fanout.ciphertext,
            fanout.nonce,
            fanout.aad,
            privateKey,
            senderDevicePublicKey,
          );
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
  }, [deviceId, privateKey, keysLoading, keysError]);

  const clearCache = useCallback(() => {
    decryptionCache.clear();
  }, []);

  return { decrypt, clearCache };
}
