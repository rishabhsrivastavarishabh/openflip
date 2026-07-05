/**
 * E2EE Crypto utilities using libsodium (X25519 + XChaCha20-Poly1305).
 * 
 * SECURITY: Private keys never leave the device.
 * All encryption/decryption happens client-side only.
 */

import sodium from 'libsodium-wrappers';

let sodiumReady = false;

export async function initCrypto(): Promise<void> {
  if (!sodiumReady) {
    await sodium.ready;
    sodiumReady = true;
  }
}

/**
 * Generate an X25519 keypair for device identity.
 * Returns base64-encoded keys.
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  await initCrypto();
  const keyPair = sodium.crypto_box_keypair();
  return {
    publicKey: sodium.to_base64(keyPair.publicKey, sodium.base64_variants.ORIGINAL),
    privateKey: sodium.to_base64(keyPair.privateKey, sodium.base64_variants.ORIGINAL),
  };
}

/**
 * Derive a shared secret between our private key and their public key (X25519).
 */
function deriveSharedKey(
  myPrivateKeyB64: string,
  theirPublicKeyB64: string
): Uint8Array {
  const myPrivateKey = sodium.from_base64(myPrivateKeyB64, sodium.base64_variants.ORIGINAL);
  const theirPublicKey = sodium.from_base64(theirPublicKeyB64, sodium.base64_variants.ORIGINAL);
  
  // Use crypto_box_beforenm for X25519 shared secret
  return sodium.crypto_box_beforenm(theirPublicKey, myPrivateKey);
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  nonce: string;      // base64
  aad: string;        // JSON metadata (conversation_id, sender_id, timestamp)
}

/**
 * Encrypt a plaintext message using XChaCha20-Poly1305 with a derived shared key.
 */
export async function encryptMessage(
  plaintext: string,
  myPrivateKeyB64: string,
  theirPublicKeyB64: string,
  aadData: Record<string, string>
): Promise<EncryptedPayload> {
  await initCrypto();
  
  const sharedKey = deriveSharedKey(myPrivateKeyB64, theirPublicKeyB64);
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const aad = JSON.stringify(aadData);
  const aadBytes = sodium.from_string(aad);
  const plaintextBytes = sodium.from_string(plaintext);
  
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintextBytes,
    aadBytes,
    null, // nsec (not used)
    nonce,
    sharedKey
  );
  
  return {
    ciphertext: sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
    aad,
  };
}

/**
 * Decrypt a ciphertext message using XChaCha20-Poly1305 with a derived shared key.
 * Returns null if decryption fails (wrong key, tampered data, etc.)
 */
export async function decryptMessage(
  ciphertextB64: string,
  nonceB64: string,
  aad: string,
  myPrivateKeyB64: string,
  theirPublicKeyB64: string
): Promise<string | null> {
  await initCrypto();
  
  try {
    const sharedKey = deriveSharedKey(myPrivateKeyB64, theirPublicKeyB64);
    const ciphertext = sodium.from_base64(ciphertextB64, sodium.base64_variants.ORIGINAL);
    const nonce = sodium.from_base64(nonceB64, sodium.base64_variants.ORIGINAL);
    const aadBytes = sodium.from_string(aad);
    
    const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null, // nsec (not used)
      ciphertext,
      aadBytes,
      nonce,
      sharedKey
    );
    
    return sodium.to_string(plaintext);
  } catch {
    // Decryption failed — wrong key, corrupted data, or tampered
    return null;
  }
}

/**
 * Get the device name for device registration.
 * Distinguishes native app (Capacitor) vs web browser.
 */
export function getDeviceName(): string {
  const isNative =
    typeof window !== 'undefined' &&
    ((window as any).Capacitor?.isNativePlatform?.() === true ||
      (window as any).Capacitor?.isNative === true);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  if (isNative) {
    if (/Android/i.test(ua)) return 'App · Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'App · iOS';
    return 'App';
  }

  if (/Edg\//.test(ua)) return 'Web · Edge';
  if (/Chrome\//.test(ua)) return 'Web · Chrome';
  if (/Firefox\//.test(ua)) return 'Web · Firefox';
  if (/Safari\//.test(ua)) return 'Web · Safari';
  return 'Web';
}
