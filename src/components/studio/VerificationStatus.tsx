import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Loader2, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BusinessVerificationFlow } from '@/components/verification/BusinessVerificationFlow';

interface RequestRow {
  id: string;
  request_id: string | null;
  status: string;
  category: string;
  business_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  notes: string | null;
}

export function VerificationStatus({ onBack }: { onBack: () => void }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('verification_requests')
        .select('id, request_id, status, category, business_name, created_at, reviewed_at, notes')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setRequests(data ?? []);
      setLoading(false);
    })();
  }, [user, applying]);

  if (applying) return <BusinessVerificationFlow onBack={() => setApplying(false)} />;

  const verified = !!(profile as any)?.is_verified;
  const pending = requests.some((r) => r.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h2 className="text-lg font-semibold">Verification Status</h2>
          <p className="text-xs text-muted-foreground">Your badge and request history</p>
        </div>
      </div>

      <div className="p-4 rounded-xl border bg-card flex items-center gap-3">
        {verified ? <BadgeCheck className="w-8 h-8 text-primary" /> : pending ? <Clock className="w-8 h-8 text-muted-foreground" /> : <XCircle className="w-8 h-8 text-muted-foreground" />}
        <div className="flex-1">
          <p className="font-medium">{verified ? 'Verified account' : pending ? 'Review in progress' : 'Not verified'}</p>
          <p className="text-xs text-muted-foreground">
            {verified ? 'Your badge is visible across Openflip.' : pending ? 'We usually review requests within a few days.' : 'Apply to get the Openflip verified badge.'}
          </p>
        </div>
        {!verified && !pending && <Button onClick={() => setApplying(true)}>Apply</Button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : requests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Request history</h3>
          {requests.map((r) => (
            <div key={r.id} className="p-3 rounded-xl border bg-card space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{r.request_id ?? r.id.slice(0, 8)}</span>
                <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{r.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {r.category}{r.business_name ? ` · ${r.business_name}` : ''} · submitted {format(new Date(r.created_at), 'dd MMM yyyy')}
                {r.reviewed_at ? ` · reviewed ${format(new Date(r.reviewed_at), 'dd MMM yyyy')}` : ''}
              </p>
              {r.notes && <p className="text-xs text-muted-foreground">Note: {r.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
