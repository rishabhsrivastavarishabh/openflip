## Phase 1: Database Migration
- Add `devices` table (user_id, device_name, device_public_key, signed_prekey_public, prekey_bundle, last_seen_at)
- Add E2EE columns to existing `messages` table: `ciphertext`, `nonce`, `aad`, `sender_device_id`, `is_encrypted`
- Add `message_receipts` table (message_id, user_id, delivered_at, seen_at)
- RLS policies for all new tables

## Phase 2: Crypto Layer (libsodium-wrappers)
- Install `libsodium-wrappers` for X25519 + XChaCha20-Poly1305
- Create `src/lib/crypto.ts` — key generation, encrypt/decrypt, shared secret derivation
- Create `src/lib/keyStore.ts` — IndexedDB wrapper for private key storage (never leaves device)
- Device registration on first login

## Phase 3: Hooks & Integration
- `useDeviceKeys` hook — manage device keypair lifecycle
- `useSendEncryptedMessage` hook — encrypt before sending
- Update existing `useConversation` hook to encrypt outgoing messages
- Decrypt incoming messages in conversation view

## Phase 4: UI Updates
- Show lock icon for E2E encrypted messages
- "Unable to decrypt" fallback for failed decryption
- Device management in Settings
- Delivery states (sending → sent → delivered → seen) using message_receipts

## Constraints
- Text messages: fully E2EE from day 1
- Media: clearly marked as "not E2EE in MVP" — encrypted text metadata but media files uploaded as-is
- Never log plaintext, never store private keys in DB
- Group chat E2EE scaffolded but not required
