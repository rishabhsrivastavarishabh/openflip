import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { StoryHighlightsEditor } from './StoryHighlightsEditor';
import { StoryHighlightViewer } from './StoryHighlightViewer';

interface Story {
  id: string;
  media_url: string;
  media_type: string;
}

interface Highlight {
  id: string;
  title: string;
  cover_url: string | null;
  stories: Story[];
}

interface StoryHighlightsProps {
  userId: string;
  isOwnProfile: boolean;
}

export function StoryHighlights({ userId, isOwnProfile }: StoryHighlightsProps) {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingHighlightId, setEditingHighlightId] = useState<string | undefined>();
  const [viewingHighlight, setViewingHighlight] = useState<Highlight | null>(null);

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

  const handleCreateHighlight = () => {
    setEditingHighlightId(undefined);
    setShowEditor(true);
  };

  const handleEditHighlight = (highlightId: string) => {
    setEditingHighlightId(highlightId);
    setShowEditor(true);
  };

  const handleViewHighlight = (highlight: Highlight) => {
    setViewingHighlight(highlight);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingHighlightId(undefined);
  };

  const handleHighlightSaved = () => {
    fetchHighlights();
  };

  const handleHighlightDeleted = () => {
    fetchHighlights();
    setViewingHighlight(null);
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
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 px-4 py-2">
          {/* Create new highlight */}
          {isOwnProfile && (
            <button
              onClick={handleCreateHighlight}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center hover:border-primary transition-colors">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">New</span>
            </button>
          )}

          {/* Existing highlights */}
          {highlights.map((highlight) => (
            <button
              key={highlight.id}
              onClick={() => handleViewHighlight(highlight)}
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

      {/* Editor Modal */}
      <StoryHighlightsEditor
        isOpen={showEditor}
        onClose={handleEditorClose}
        highlightId={editingHighlightId}
        onSaved={handleHighlightSaved}
      />

      {/* Viewer Modal */}
      {viewingHighlight && (
        <StoryHighlightViewer
          highlight={viewingHighlight}
          isOpen={!!viewingHighlight}
          onClose={() => setViewingHighlight(null)}
          isOwnProfile={isOwnProfile}
          onEdit={handleEditHighlight}
          onDeleted={handleHighlightDeleted}
        />
      )}
    </>
  );
}
