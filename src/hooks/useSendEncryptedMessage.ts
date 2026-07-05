/**
 * Hook for sending E2E encrypted messages.
 * Encrypts plaintext client-side before inserting ciphertext into the database.
 * NEVER sends plaintext to the server.
 *
 * Multi-device fan-out: after inserting the primary encrypted message (which
 * targets the recipient's most-recent device), we also encrypt a copy for
 * every OTHER active device belonging to the recipient AND every OTHER active
 * device belonging to the sender. Those extra copies live in
 * `message_device_keys` so any signed-in device can decrypt its own copy.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDeviceKeys } from './useDeviceKeys';
import { encryptMessage } from '@/lib/crypto';
import { toast } from 'sonner';

export function useSendEncryptedMessage() {
  const { user } = useAuth();
  const { deviceId, privateKey, getRecipientPublicKey, getAllRecipientDeviceKeys } = useDeviceKeys();

  const sendEncrypted = useCallback(async (
    conversationId: string,
    plaintext: string,
    recipientUserId: string,
    options?: {
      messageType?: string;
      mediaUrl?: string;
      voiceDuration?: number;
      isViewOnce?: boolean;
      expiresAt?: string;
    }
  ): Promise<boolean> => {
    if (!user || !deviceId || !privateKey) {
      toast.error('Encryption not ready. Please wait...');
      return false;
    }

    try {
      // Get recipient's primary public key (most recent device)
      const recipientPublicKey = await getRecipientPublicKey(recipientUserId);
      
      if (!recipientPublicKey) {
        // Recipient has no device registered — send unencrypted with warning
        console.warn('Recipient has no E2EE device. Sending unencrypted.');
        
        const insertData: any = {
          conversation_id: conversationId,
          sender_id: user.id,
          content: plaintext,
          is_encrypted: false,
          sender_device_id: deviceId,
        };
        if (options?.messageType) insertData.message_type = options.messageType;
        if (options?.mediaUrl) insertData.media_url = options.mediaUrl;
        if (options?.voiceDuration) insertData.voice_duration = options.voiceDuration;
        if (options?.isViewOnce) insertData.is_view_once = true;
        if (options?.expiresAt) insertData.expires_at = options.expiresAt;

        const { error } = await supabase.from('messages').insert(insertData);
        if (error) throw error;
        return true;
      }

      const aad = {
        conversation_id: conversationId,
        sender_id: user.id,
        timestamp: new Date().toISOString(),
      };

      // Encrypt the primary copy for the recipient's newest device.
      const encrypted = await encryptMessage(plaintext, privateKey, recipientPublicKey, aad);

      const insertData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: '🔒 Encrypted message',
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        aad: encrypted.aad,
        sender_device_id: deviceId,
        is_encrypted: true,
      };
      if (options?.messageType) insertData.message_type = options.messageType;
      if (options?.mediaUrl) insertData.media_url = options.mediaUrl;
      if (options?.voiceDuration) insertData.voice_duration = options.voiceDuration;
      if (options?.isViewOnce) insertData.is_view_once = true;
      if (options?.expiresAt) insertData.expires_at = options.expiresAt;

      const { data: inserted, error } = await supabase
        .from('messages')
        .insert(insertData)
        .select('id')
        .single();
      if (error) throw error;
      const messageId = inserted?.id as string | undefined;

      // Fan-out: also encrypt for every OTHER recipient device and every OTHER
      // sender device, so a message decrypts on every signed-in device. This
      // runs after the primary insert so a fan-out failure never blocks the
      // main send.
      if (messageId) {
        (async () => {
          try {
            const [recipientDevices, senderDevices] = await Promise.all([
              getAllRecipientDeviceKeys(recipientUserId),
              getAllRecipientDeviceKeys(user.id),
            ]);
            const extras = [
              ...recipientDevices.filter((d) => d.device_public_key !== recipientPublicKey),
              ...senderDevices.filter((d) => d.id !== deviceId),
            ];
            if (extras.length === 0) return;

            const rows = await Promise.all(
              extras.map(async (dev) => {
                const enc = await encryptMessage(plaintext, privateKey, dev.device_public_key, aad);
                return {
                  message_id: messageId,
                  recipient_device_id: dev.id,
                  ciphertext: enc.ciphertext,
                  nonce: enc.nonce,
                  aad: enc.aad,
                };
              }),
            );
            await (supabase as any).from('message_device_keys').insert(rows);
          } catch (e) {
            console.warn('Multi-device fan-out failed (primary message still delivered):', e);
          }
        })();
      }

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Fire background web push to the recipient (best-effort).
      try {
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        const preview = options?.mediaUrl
          ? '📎 Sent an attachment'
          : plaintext.length > 120
            ? plaintext.slice(0, 120) + '…'
            : plaintext;
        supabase.functions
          .invoke('send-push', {
            body: {
              user_id: recipientUserId,
              title: senderProfile?.username ?? 'New message',
              body: recipientPublicKey ? '🔒 New encrypted message' : preview,
              type: 'message',
              tag: `conv-${conversationId}`,
              icon: senderProfile?.avatar_url ?? undefined,
              data: { url: `/messages/${conversationId}`, conversationId },
            },
          })
          .catch(() => {});
      } catch (_) {}

      return true;
    } catch (err) {
      console.error('Failed to send encrypted message:', err);
      toast.error('Failed to send message');
      return false;
    }
  }, [user, deviceId, privateKey, getRecipientPublicKey, getAllRecipientDeviceKeys]);

  return {
    sendEncrypted,
    isReady: !!deviceId && !!privateKey,
  };
}
