/**
 * Hook to decrypt messages locally.
 * Decryption happens client-side only — private keys never leave the device.
 */

import { useCallback, useRef } from 'react';
import { decryptMessage, initCrypto } from '@/lib/crypto';
import { useDeviceKeys } from './useDeviceKeys';

// In-memory cache to avoid re-decrypting the same message
const decryptionCache = new Map<string, string>();

export function useDecryptMessage() {
  const { privateKey } = useDeviceKeys();
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

    if (!privateKey || !senderDevicePublicKey) {
      return '🔒 Unable to decrypt message';
    }

    try {
      if (!initRef.current) {
        await initCrypto();
        initRef.current = true;
      }

      const plaintext = await decryptMessage(
        ciphertext,
        nonce,
        aad,
        privateKey,
        senderDevicePublicKey
      );

      if (plaintext === null) {
        return '🔒 Unable to decrypt message';
      }

      // Cache the result
      decryptionCache.set(messageId, plaintext);
      return plaintext;
    } catch {
      return '🔒 Unable to decrypt message';
    }
  }, [privateKey]);

  const clearCache = useCallback(() => {
    decryptionCache.clear();
  }, []);

  return { decrypt, clearCache };
}
