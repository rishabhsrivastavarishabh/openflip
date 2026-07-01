import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useStartCall() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const startCall = useCallback(
    async (opts: { calleeId: string; conversationId?: string | null; type: 'voice' | 'video' }) => {
      if (!user) return;
      setStarting(true);
      try {
        const { data, error } = await supabase
          .from('calls')
          .insert({
            caller_id: user.id,
            callee_id: opts.calleeId,
            conversation_id: opts.conversationId ?? null,
            call_type: opts.type,
            status: 'ringing',
          })
          .select('id')
          .single();
        if (error) throw error;

        // Fire background push to callee (best-effort)
        supabase.functions
          .invoke('send-push', {
            body: {
              user_id: opts.calleeId,
              title: `${opts.type === 'video' ? 'Video' : 'Voice'} call`,
              body: `${profile?.username ?? 'Someone'} is calling you`,
              type: 'call',
              tag: `call-${data.id}`,
              requireInteraction: true,
              data: { url: `/call/${data.id}`, callId: data.id, type: 'call' },
            },
          })
          .catch(() => {});

        navigate(`/call/${data.id}`);
      } catch (e: any) {
        toast.error(e.message || 'Failed to start call');
      } finally {
        setStarting(false);
      }
    },
    [user, profile, navigate],
  );

  return { startCall, starting };
}
