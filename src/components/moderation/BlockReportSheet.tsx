import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Ban, Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface BlockReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUsername: string;
  context?: {
    postId?: string;
    reelId?: string;
    storyId?: string;
    messageId?: string;
  };
  onBlocked?: () => void;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam', description: 'Unwanted commercial content or spam' },
  { value: 'harassment', label: 'Harassment', description: 'Bullying, threats, or harassment' },
  { value: 'inappropriate', label: 'Inappropriate content', description: 'Nudity, violence, or hate speech' },
  { value: 'fake', label: 'Fake account', description: 'Impersonation or misleading identity' },
  { value: 'other', label: 'Other', description: 'Something else not listed' },
];

export function BlockReportSheet({
  open,
  onOpenChange,
  targetUserId,
  targetUsername,
  context,
  onBlocked,
}: BlockReportSheetProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'menu' | 'block' | 'report'>('menu');
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  

  const handleBlock = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Insert block record
      await (supabase as any).from('blocked_users').insert({
        blocker_id: user.id,
        blocked_id: targetUserId,
      });

      // Remove any follow relationships
      await Promise.all([
        supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId),
        supabase
          .from('follows')
          .delete()
          .eq('follower_id', targetUserId)
          .eq('following_id', user.id),
      ]);

      // Remove any pending follow requests
      await Promise.all([
        supabase
          .from('follow_requests')
          .delete()
          .eq('requester_id', user.id)
          .eq('target_id', targetUserId),
        supabase
          .from('follow_requests')
          .delete()
          .eq('requester_id', targetUserId)
          .eq('target_id', user.id),
      ]);

      toast.success(`Blocked ${targetUsername}`);
      onBlocked?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async () => {
    if (!user || !selectedReason) return;

    setLoading(true);
    try {
      await (supabase as any).from('reports').insert({
        reporter_id: user.id,
        reported_user_id: targetUserId,
        reported_post_id: context?.postId || null,
        reported_reel_id: context?.reelId || null,
        reported_story_id: context?.storyId || null,
        reported_message_id: context?.messageId || null,
        reason: selectedReason,
        description: description.trim() || null,
      });

      toast.success('Report submitted. We will review this shortly.');
      setSelectedReason('');
      setDescription('');
      
      setMode('menu');
      onOpenChange(false);
    } catch (error) {
      console.error('Error reporting:', error);
      toast.error('Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setMode('menu');
    setSelectedReason('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={resetAndClose}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        {mode === 'menu' && (
          <>
            <SheetHeader>
              <SheetTitle>@{targetUsername}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              <Button
                variant="destructive"
                className="w-full justify-start gap-3"
                onClick={() => setMode('block')}
              >
                <Ban className="w-5 h-5" />
                Block user
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setMode('report')}
              >
                <Flag className="w-5 h-5" />
                Report user
              </Button>
            </div>
          </>
        )}

        {mode === 'block' && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-destructive" />
                Block @{targetUsername}?
              </SheetTitle>
              <SheetDescription>
                They won't be able to find your profile, posts, stories, or message you.
                They won't be notified that you've blocked them.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setMode('menu')}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleBlock}
                disabled={loading}
              >
                {loading ? 'Blocking...' : 'Block'}
              </Button>
            </div>
          </>
        )}

        {mode === 'report' && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Report @{targetUsername}
              </SheetTitle>
              <SheetDescription>
                Help us understand what's happening
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
                {REPORT_REASONS.map((reason) => (
                  <div key={reason.value} className="flex items-start space-x-3 py-2">
                    <RadioGroupItem value={reason.value} id={reason.value} className="mt-0.5" />
                    <Label htmlFor={reason.value} className="cursor-pointer">
                      <div className="font-medium">{reason.label}</div>
                      <div className="text-xs text-muted-foreground">{reason.description}</div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {selectedReason && (
                <Textarea
                  placeholder="Additional details (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setMode('menu')}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleReport}
                  disabled={loading || !selectedReason}
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
