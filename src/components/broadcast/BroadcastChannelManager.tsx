import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Radio, Users, Plus, Settings, Camera, Loader2, Bell, BellOff, Lock, Globe, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface BroadcastChannel {
  id: string;
  group_name: string;
  broadcast_description: string | null;
  group_avatar_url: string | null;
  created_by: string;
  created_at: string;
  follower_count?: number;
  is_following?: boolean;
}

interface BroadcastChannelManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BroadcastChannelManager({ open, onOpenChange }: BroadcastChannelManagerProps) {
  const { user, profile } = useAuth();
  const [channels, setChannels] = useState<BroadcastChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: '',
    description: '',
    isPublic: true,
  });

  useEffect(() => {
    if (open && user) {
      fetchMyChannels();
    }
  }, [open, user]);

  const fetchMyChannels = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch broadcast channels created by user
      const { data: channelsData, error } = await (supabase as any)
        .from('conversations')
        .select('*')
        .eq('is_broadcast', true)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get follower counts
      const channelIds = channelsData?.map((c: any) => c.id) || [];
      if (channelIds.length > 0) {
        const { data: followers } = await supabase
          .from('broadcast_followers')
          .select('channel_id')
          .in('channel_id', channelIds);

        const followerCounts = new Map<string, number>();
        followers?.forEach((f: any) => {
          followerCounts.set(f.channel_id, (followerCounts.get(f.channel_id) || 0) + 1);
        });

        const enrichedChannels = channelsData?.map((c: any) => ({
          ...c,
          follower_count: followerCounts.get(c.id) || 0,
        })) || [];

        setChannels(enrichedChannels);
      } else {
        setChannels([]);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!user || !newChannel.name.trim()) return;
    setCreating(true);

    try {
      const { data, error } = await (supabase as any)
        .from('conversations')
        .insert({
          is_broadcast: true,
          group_name: newChannel.name.trim(),
          broadcast_description: newChannel.description.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as admin participant
      await supabase.from('conversation_participants').insert({
        conversation_id: data.id,
        user_id: user.id,
        is_admin: true,
        can_post: true,
      });

      setChannels(prev => [{ ...data, follower_count: 0 }, ...prev]);
      setShowCreate(false);
      setNewChannel({ name: '', description: '', isPublic: true });
      toast.success('Broadcast channel created!');
    } catch (error) {
      console.error('Error creating channel:', error);
      toast.error('Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this broadcast channel?')) return;

    try {
      // Delete followers first
      await supabase.from('broadcast_followers').delete().eq('channel_id', channelId);
      
      // Delete participants
      await supabase.from('conversation_participants').delete().eq('conversation_id', channelId);
      
      // Delete messages
      await supabase.from('messages').delete().eq('conversation_id', channelId);
      
      // Delete channel
      await (supabase as any).from('conversations').delete().eq('id', channelId);

      setChannels(prev => prev.filter(c => c.id !== channelId));
      toast.success('Channel deleted');
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast.error('Failed to delete channel');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            Broadcast Channels
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {/* Create new button */}
          <Button
            variant="gradient"
            className="w-full"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Channel
          </Button>

          {/* Channels list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-12">
              <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No broadcast channels yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a channel to share announcements with your followers
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map(channel => (
                <motion.div
                  key={channel.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-secondary/50 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      {channel.group_avatar_url ? (
                        <AvatarImage src={channel.group_avatar_url} />
                      ) : (
                        <AvatarFallback className="bg-primary/10">
                          <Radio className="w-5 h-5 text-primary" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{channel.group_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {channel.follower_count} followers
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteChannel(channel.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {channel.broadcast_description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {channel.broadcast_description}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Create channel dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Broadcast Channel</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  placeholder="My Announcements"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel-desc">Description (optional)</Label>
                <Textarea
                  id="channel-desc"
                  placeholder="What is this channel about?"
                  value={newChannel.description}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Public Channel</p>
                    <p className="text-xs text-muted-foreground">Anyone can find and follow</p>
                  </div>
                </div>
                <Switch
                  checked={newChannel.isPublic}
                  onCheckedChange={(checked) => setNewChannel(prev => ({ ...prev, isPublic: checked }))}
                />
              </div>

              <Button
                variant="gradient"
                className="w-full"
                onClick={handleCreateChannel}
                disabled={creating || !newChannel.name.trim()}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Channel'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
