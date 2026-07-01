import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface IncomingCall {
  id: string;
  caller_id: string;
  callee_id: string;
  conversation_id: string | null;
  call_type: 'voice' | 'video';
  status: string;
  created_at: string;
  caller?: {
    id: string;
    username: string;
    avatar_url: string | null;
    full_name: string | null;
  } | null;
}

export function useIncomingCalls() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  const dismiss = useCallback(() => setIncomingCall(null), []);

  const fetchCaller = useCallback(async (call: any): Promise<IncomingCall> => {
    const { data: caller } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, full_name')
      .eq('id', call.caller_id)
      .maybeSingle();
    return { ...call, caller };
  }, []);

  useEffect(() => {
    if (!user) return;

    // On mount, look for any recent ringing calls (last 60 seconds)
    (async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data } = await supabase
        .from('calls')
        .select('*')
        .eq('callee_id', user.id)
        .eq('status', 'ringing')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setIncomingCall(await fetchCaller(data));
    })();

    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${user.id}`,
        },
        async (payload) => {
          const call = payload.new as any;
          if (call.status !== 'ringing') return;
          setIncomingCall(await fetchCaller(call));
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${user.id}`,
        },
        (payload) => {
          const call = payload.new as any;
          if (call.status !== 'ringing') {
            setIncomingCall((prev) => (prev && prev.id === call.id ? null : prev));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchCaller]);

  const accept = useCallback(async () => {
    if (!incomingCall) return null;
    const id = incomingCall.id;
    await supabase
      .from('calls')
      .update({ status: 'accepted', started_at: new Date().toISOString() })
      .eq('id', id);
    setIncomingCall(null);
    return id;
  }, [incomingCall]);

  const decline = useCallback(async () => {
    if (!incomingCall) return;
    await supabase
      .from('calls')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', incomingCall.id);
    setIncomingCall(null);
  }, [incomingCall]);

  return { incomingCall, accept, decline, dismiss };
}
