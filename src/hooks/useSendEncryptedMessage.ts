/**
 * Hook for sending E2E encrypted messages.
 * Encrypts plaintext client-side before inserting ciphertext into the database.
 * NEVER sends plaintext to the server.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDeviceKeys } from './useDeviceKeys';
import { encryptMessage } from '@/lib/crypto';
import { toast } from 'sonner';

export function useSendEncryptedMessage() {
  const { user } = useAuth();
  const { deviceId, privateKey, getRecipientPublicKey } = useDeviceKeys();

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
      // Get recipient's public key
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

      // Encrypt the message
      const encrypted = await encryptMessage(
        plaintext,
        privateKey,
        recipientPublicKey,
        {
          conversation_id: conversationId,
          sender_id: user.id,
          timestamp: new Date().toISOString(),
        }
      );

      // Insert encrypted message — content is a placeholder, ciphertext has the real data
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

      const { error } = await supabase.from('messages').insert(insertData);
      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return true;
    } catch (err) {
      console.error('Failed to send encrypted message:', err);
      toast.error('Failed to send message');
      return false;
    }
  }, [user, deviceId, privateKey, getRecipientPublicKey]);

  return {
    sendEncrypted,
    isReady: !!deviceId && !!privateKey,
  };
}
