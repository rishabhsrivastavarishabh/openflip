import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Image, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Story {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
}

interface Highlight {
  id: string;
  title: string;
  cover_url: string | null;
}

interface StoryHighlightsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  highlightId?: string; // If editing existing highlight
  onSaved?: () => void;
}

export function StoryHighlightsEditor({
  isOpen,
  onClose,
  highlightId,
  onSaved,
}: StoryHighlightsEditorProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'stories' | 'cover' | 'name'>('stories');

  useEffect(() => {
    if (isOpen && user) {
      fetchStories();
      if (highlightId) {
        fetchHighlightDetails();
      }
    }
  }, [isOpen, user, highlightId]);

  const fetchStories = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get all stories (including expired ones for highlights)
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStories(data || []);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHighlightDetails = async () => {
    if (!highlightId) return;

    try {
      const { data: highlight } = await (supabase as any)
        .from('story_highlights')
        .select(`
          id,
          title,
          cover_url,
          highlight_stories (
            story_id
          )
        `)
        .eq('id', highlightId)
        .single();

      if (highlight) {
        setTitle(highlight.title);
        setSelectedCover(highlight.cover_url);
        setSelectedStories(new Set(highlight.highlight_stories?.map((hs: any) => hs.story_id) || []));
      }
    } catch (error) {
      console.error('Error fetching highlight:', error);
    }
  };

  const toggleStory = (storyId: string) => {
    setSelectedStories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storyId)) {
        newSet.delete(storyId);
      } else {
        newSet.add(storyId);
      }
      return newSet;
    });
  };

  const handleNext = () => {
    if (step === 'stories') {
      if (selectedStories.size === 0) {
        toast.error('Select at least one story');
        return;
      }
      setStep('cover');
    } else if (step === 'cover') {
      setStep('name');
    }
  };

  const handleBack = () => {
    if (step === 'name') setStep('cover');
    else if (step === 'cover') setStep('stories');
    else onClose();
  };

  const handleSave = async () => {
    if (!user || !title.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setSaving(true);

    try {
      if (highlightId) {
        // Update existing highlight
        await (supabase as any)
          .from('story_highlights')
          .update({
            title: title.trim(),
            cover_url: selectedCover,
          })
          .eq('id', highlightId);

        // Remove old story associations
        await (supabase as any)
          .from('highlight_stories')
          .delete()
          .eq('highlight_id', highlightId);

        // Add new story associations
        const storyAssociations = Array.from(selectedStories).map(storyId => ({
          highlight_id: highlightId,
          story_id: storyId,
        }));

        await (supabase as any)
          .from('highlight_stories')
          .insert(storyAssociations);

        toast.success('Highlight updated!');
      } else {
        // Create new highlight
        const { data: newHighlight, error } = await (supabase as any)
          .from('story_highlights')
          .insert({
            user_id: user.id,
            title: title.trim(),
            cover_url: selectedCover,
          })
          .select()
          .single();

        if (error) throw error;

        // Add story associations
        const storyAssociations = Array.from(selectedStories).map(storyId => ({
          highlight_id: newHighlight.id,
          story_id: storyId,
        }));

        await (supabase as any)
          .from('highlight_stories')
          .insert(storyAssociations);

        toast.success('Highlight created!');
      }

      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Error saving highlight:', error);
      toast.error('Failed to save highlight');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <button onClick={handleBack}>
            <X className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">
            {step === 'stories' && 'Select Stories'}
            {step === 'cover' && 'Choose Cover'}
            {step === 'name' && 'Name Highlight'}
          </h1>
          {step !== 'name' ? (
            <Button onClick={handleNext} size="sm" variant="ghost">
              Next
            </Button>
          ) : (
            <Button onClick={handleSave} size="sm" disabled={saving || !title.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Done'}
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Step 1: Select Stories */}
              {step === 'stories' && (
                <ScrollArea className="h-full">
                  <div className="p-4 grid grid-cols-3 gap-2">
                    {stories.length === 0 ? (
                      <div className="col-span-3 text-center py-12 text-muted-foreground">
                        <Image className="w-12 h-12 mx-auto mb-4" />
                        <p>No stories to add</p>
                        <p className="text-sm">Create a story first</p>
                      </div>
                    ) : (
                      stories.map(story => (
                        <button
                          key={story.id}
                          onClick={() => toggleStory(story.id)}
                          className={cn(
                            "relative aspect-[9/16] rounded-lg overflow-hidden ring-2 transition-all",
                            selectedStories.has(story.id)
                              ? "ring-primary"
                              : "ring-transparent"
                          )}
                        >
                          {story.media_type === 'video' ? (
                            <video
                              src={story.media_url}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={story.media_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                          {selectedStories.has(story.id) && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              )}

              {/* Step 2: Choose Cover */}
              {step === 'cover' && (
                <ScrollArea className="h-full">
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                      Select a cover for your highlight
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from(selectedStories).map(storyId => {
                        const story = stories.find(s => s.id === storyId);
                        if (!story) return null;
                        return (
                          <button
                            key={story.id}
                            onClick={() => setSelectedCover(story.media_url)}
                            className={cn(
                              "relative aspect-square rounded-full overflow-hidden ring-2 transition-all",
                              selectedCover === story.media_url
                                ? "ring-primary"
                                : "ring-transparent"
                            )}
                          >
                            <img
                              src={story.media_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                            {selectedCover === story.media_url && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                <Check className="w-8 h-8 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              )}

              {/* Step 3: Name Highlight */}
              {step === 'name' && (
                <div className="p-6 space-y-6">
                  {/* Preview */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-24 h-24 rounded-full ring-2 ring-border overflow-hidden bg-muted">
                      {selectedCover ? (
                        <img
                          src={selectedCover}
                          alt="Cover"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="Highlight name"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={20}
                      className="text-center max-w-xs"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      {selectedStories.size} {selectedStories.size === 1 ? 'story' : 'stories'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
