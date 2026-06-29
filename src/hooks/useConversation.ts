import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useConversation() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get or create a conversation with a user
  const startConversation = useCallback(async (targetUserId: string, navigateToChat = true) => {
    if (!user) {
      navigate('/auth');
      return null;
    }

    if (targetUserId === user.id) {
      toast.error("You can't message yourself");
      return null;
    }

    try {

      // Manual lookup and creation (fallback since RPC might not be in types)
      const { data: myConversations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const myConvoIds = myConversations?.map(c => c.conversation_id) || [];

      if (myConvoIds.length > 0) {
        // Find existing 1-on-1 conversation
        const { data: existingConvo } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', targetUserId)
          .in('conversation_id', myConvoIds)
          .limit(1)
          .maybeSingle();

        if (existingConvo) {
          if (navigateToChat) {
            navigate(`/messages/${existingConvo.conversation_id}`);
          }
          return existingConvo.conversation_id;
        }
      }

      // Create new conversation
      const { data: newConvo, error: convoError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convoError) throw convoError;

      await supabase.from('conversation_participants').insert([
        { conversation_id: newConvo.id, user_id: user.id },
        { conversation_id: newConvo.id, user_id: targetUserId },
      ]);

      if (navigateToChat) {
        navigate(`/messages/${newConvo.id}`);
      }
      return newConvo.id;
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
      return null;
    }
  }, [user, navigate]);

  // Send a message to a conversation
  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    options?: {
      messageType?: 'text' | 'image' | 'voice' | 'post_share' | 'reel_share' | 'profile_share';
      mediaUrl?: string;
      voiceDuration?: number;
      sharedPostId?: string;
      sharedReelId?: string;
      sharedProfileId?: string;
    }
  ) => {
    if (!user) return null;

    try {
      // Use type assertion since new columns might not be in types yet
      const insertData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        content,
      };
      
      if (options?.messageType) insertData.message_type = options.messageType;
      if (options?.mediaUrl) insertData.media_url = options.mediaUrl;
      if (options?.voiceDuration) insertData.voice_duration = options.voiceDuration;
      if (options?.sharedPostId) insertData.shared_post_id = options.sharedPostId;
      if (options?.sharedReelId) insertData.shared_reel_id = options.sharedReelId;
      if (options?.sharedProfileId) insertData.shared_profile_id = options.sharedProfileId;

      const { data, error } = await supabase
        .from('messages')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      return null;
    }
  }, [user]);

  // Share a post to a conversation
  const sharePost = useCallback(async (postId: string, conversationId: string) => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    return sendMessage(conversationId, postUrl, {
      messageType: 'post_share',
      sharedPostId: postId,
    });
  }, [sendMessage]);

  // Share a reel to a conversation
  const shareReel = useCallback(async (reelId: string, conversationId: string) => {
    const reelUrl = `${window.location.origin}/reels?id=${reelId}`;
    return sendMessage(conversationId, reelUrl, {
      messageType: 'reel_share',
      sharedReelId: reelId,
    });
  }, [sendMessage]);

  // Share a profile to a conversation
  const shareProfile = useCallback(async (profileId: string, conversationId: string) => {
    const profileUrl = `${window.location.origin}/profile/${profileId}`;
    return sendMessage(conversationId, profileUrl, {
      messageType: 'profile_share',
      sharedProfileId: profileId,
    });
  }, [sendMessage]);

  // Create a group conversation
  const createGroupChat = useCallback(async (
    name: string,
    participantIds: string[],
    avatarUrl?: string
  ) => {
    if (!user) return null;

    try {
      // Use type assertion for new columns
      const { data: newConvo, error: convoError } = await (supabase as any)
        .from('conversations')
        .insert({
          is_group: true,
          group_name: name,
          group_avatar_url: avatarUrl,
          created_by: user.id,
        })
        .select()
        .single();

      if (convoError) throw convoError;

      // Add all participants including creator
      const allParticipants = [...new Set([user.id, ...participantIds])];
      await supabase.from('conversation_participants').insert(
        allParticipants.map((userId) => ({
          conversation_id: newConvo.id,
          user_id: userId,
        }))
      );

      navigate(`/messages/${newConvo.id}`);
      return newConvo.id;
    } catch (error) {
      console.error('Error creating group chat:', error);
      toast.error('Failed to create group');
      return null;
    }
  }, [user, navigate]);

  return {
    startConversation,
    sendMessage,
    sharePost,
    shareReel,
    shareProfile,
    createGroupChat,
  };
}
