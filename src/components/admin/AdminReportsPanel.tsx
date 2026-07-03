import { useState, useEffect } from 'react';
import { Loader2, Flag, User, FileText, Film, MessageCircle, BookOpen, Check, X, Ban, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_post_id: string | null;
  reported_reel_id: string | null;
  reported_comment_id: string | null;
  reported_reel_comment_id: string | null;
  reported_story_id: string | null;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  action_taken?: string | null;
  reporter?: { username: string; avatar_url: string | null } | null;
  reported_user?: { username: string; avatar_url: string | null } | null;
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  resolved: 'bg-green-500/20 text-green-600 border-green-500/30',
  dismissed: 'bg-muted text-muted-foreground',
};

function getTargetIcon(r: Report) {
  if (r.reported_post_id) return <FileText className="w-4 h-4" />;
  if (r.reported_reel_id) return <Film className="w-4 h-4" />;
  if (r.reported_story_id) return <BookOpen className="w-4 h-4" />;
  if (r.reported_comment_id || r.reported_reel_comment_id) return <MessageCircle className="w-4 h-4" />;
  return <User className="w-4 h-4" />;
}

function getTargetLabel(r: Report) {
  if (r.reported_post_id) return 'Post';
  if (r.reported_reel_id) return 'Reel';
  if (r.reported_story_id) return 'Story';
  if (r.reported_comment_id || r.reported_reel_comment_id) return 'Comment';
  return 'Account';
}

export function AdminReportsPanel() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [actioning, setActioning] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('reports')
      .select('*')
      .eq('status', tab)
      .order('created_at', { ascending: false })
      .limit(200);

    const list = (data || []) as Report[];
    const userIds = Array.from(new Set(list.flatMap(r => [r.reporter_id, r.reported_user_id].filter(Boolean)))) as string[];
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      list.forEach(r => {
        r.reporter = map.get(r.reporter_id) || null;
        r.reported_user = r.reported_user_id ? map.get(r.reported_user_id) || null : null;
      });
    }
    setReports(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const resolveReport = async (r: Report, action: 'dismissed' | 'resolved', payload?: { action_taken?: string }) => {
    setActioning(r.id);
    await (supabase as any)
      .from('reports')
      .update({
        status: action,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        action_taken: payload?.action_taken || null,
      })
      .eq('id', r.id);
    toast.success(action === 'resolved' ? 'Report resolved' : 'Report dismissed');
    setActioning(null);
    load();
  };

  const removeContent = async (r: Report) => {
    if (!confirm('Remove the reported content? This cannot be undone.')) return;
    setActioning(r.id);
    try {
      if (r.reported_post_id) await supabase.from('posts').delete().eq('id', r.reported_post_id);
      if (r.reported_reel_id) await supabase.from('reels').delete().eq('id', r.reported_reel_id);
      if (r.reported_story_id) await supabase.from('stories').delete().eq('id', r.reported_story_id);
      if (r.reported_comment_id) await supabase.from('comments').delete().eq('id', r.reported_comment_id);
      if (r.reported_reel_comment_id) await supabase.from('reel_comments').delete().eq('id', r.reported_reel_comment_id);
      await resolveReport(r, 'resolved', { action_taken: 'content_removed' });
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove content');
      setActioning(null);
    }
  };

  const banUser = async (r: Report) => {
    if (!r.reported_user_id) return;
    if (!confirm('Ban this user permanently?')) return;
    setActioning(r.id);
    await (supabase as any)
      .from('profiles')
      .update({
        account_status: 'banned',
        moderation_reason: `Report: ${r.reason}`,
        moderated_at: new Date().toISOString(),
        moderated_by: user?.id,
      })
      .eq('id', r.reported_user_id);
    toast.success('User banned');
    await resolveReport(r, 'resolved', { action_taken: 'user_banned' });
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Flag className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No {tab} reports</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(r => (
                <div key={r.id} className="glass-card rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
                        {getTargetIcon(r)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{getTargetLabel(r)}</span>
                          <Badge variant="outline" className="text-[10px]">{r.reason}</Badge>
                          <Badge className={`text-[10px] ${statusColors[r.status]}`}>{r.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          by @{r.reporter?.username || '…'} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </p>
                        {r.reported_user && (
                          <p className="text-xs text-muted-foreground">against @{r.reported_user.username}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {r.description && (
                    <p className="text-sm bg-secondary/40 rounded-lg p-2">{r.description}</p>
                  )}

                  {tab === 'pending' && (
                    <div className="flex flex-wrap gap-2">
                      {(r.reported_post_id || r.reported_reel_id || r.reported_story_id || r.reported_comment_id || r.reported_reel_comment_id) && (
                        <Button size="sm" variant="destructive" onClick={() => removeContent(r)} disabled={!!actioning}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove content
                        </Button>
                      )}
                      {r.reported_user_id && (
                        <Button size="sm" variant="destructive" onClick={() => banUser(r)} disabled={!!actioning}>
                          <Ban className="w-3.5 h-3.5 mr-1" /> Ban user
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => resolveReport(r, 'resolved', { action_taken: 'warning_issued' })} disabled={!!actioning}>
                        <Check className="w-3.5 h-3.5 mr-1" /> Mark resolved
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resolveReport(r, 'dismissed')} disabled={!!actioning}>
                        <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                      </Button>
                    </div>
                  )}

                  {tab !== 'pending' && r.action_taken && (
                    <p className="text-xs text-muted-foreground">Action: {r.action_taken.replace(/_/g, ' ')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
