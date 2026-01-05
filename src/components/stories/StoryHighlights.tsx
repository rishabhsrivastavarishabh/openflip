import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Highlight {
  id: string;
  title: string;
  cover_url: string | null;
  stories: {
    id: string;
    media_url: string;
    media_type: string;
  }[];
}

interface StoryHighlightsProps {
  userId: string;
  isOwnProfile: boolean;
  onViewHighlight?: (highlight: Highlight) => void;
}

export function StoryHighlights({ userId, isOwnProfile, onViewHighlight }: StoryHighlightsProps) {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchHighlights();
  }, [userId]);

  const fetchHighlights = async () => {
    try {
      const { data: highlightsData, error } = await (supabase as any)
        .from('story_highlights')
        .select(`
          id,
          title,
          cover_url,
          highlight_stories (
            story_id,
            stories (
              id,
              media_url,
              media_type
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedHighlights: Highlight[] = (highlightsData || []).map((h: any) => ({
        id: h.id,
        title: h.title,
        cover_url: h.cover_url || h.highlight_stories?.[0]?.stories?.media_url || null,
        stories: h.highlight_stories?.map((hs: any) => hs.stories).filter(Boolean) || [],
      }));

      setHighlights(formattedHighlights);
    } catch (error) {
      console.error('Error fetching highlights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHighlight = async () => {
    if (!user || !newTitle.trim()) return;

    setCreating(true);
    try {
      const { error } = await (supabase as any)
        .from('story_highlights')
        .insert({
          user_id: user.id,
          title: newTitle.trim(),
        });

      if (error) throw error;

      toast.success('Highlight created! Add stories from your story viewer.');
      setNewTitle('');
      setShowCreateDialog(false);
      fetchHighlights();
    } catch (error) {
      console.error('Error creating highlight:', error);
      toast.error('Failed to create highlight');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-4 px-4 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
            <div className="w-10 h-2 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (highlights.length === 0 && !isOwnProfile) {
    return null;
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 px-4 py-2">
        {/* Create new highlight */}
        {isOwnProfile && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <button className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center hover:border-primary transition-colors">
                  <Plus className="w-6 h-6 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">New</span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Highlight</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Highlight name"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={20}
                />
                <Button
                  onClick={handleCreateHighlight}
                  disabled={!newTitle.trim() || creating}
                  className="w-full"
                >
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Existing highlights */}
        {highlights.map((highlight) => (
          <button
            key={highlight.id}
            onClick={() => onViewHighlight?.(highlight)}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div className="w-16 h-16 rounded-full ring-2 ring-border overflow-hidden bg-muted">
              {highlight.cover_url ? (
                <img
                  src={highlight.cover_url}
                  alt={highlight.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  No stories
                </div>
              )}
            </div>
            <span className="text-xs text-foreground truncate max-w-[64px]">
              {highlight.title}
            </span>
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
