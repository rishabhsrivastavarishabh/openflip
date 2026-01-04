import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StoryRing } from './StoryRing';
import { StoryGroup } from '@/types/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface StoriesBarProps {
  onViewStory: (storyGroup: StoryGroup) => void;
  onCreateStory: () => void;
}

export function StoriesBar({ onViewStory, onCreateStory }: StoriesBarProps) {
  const { user, profile } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [ownStories, setOwnStories] = useState<StoryGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStories();
    }
  }, [user]);

  const fetchStories = async () => {
    if (!user) return;

    try {
      // Fetch active stories from followed users
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingData?.map(f => f.following_id) || [];
      const userIdsToFetch = [...followingIds, user.id];

      // Get stories from followed users and own stories
      const { data: stories, error } = await supabase
        .from('stories')
        .select('*')
        .in('user_id', userIdsToFetch)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profiles for story users
      const storyUserIds = [...new Set(stories?.map(s => s.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, is_verified')
        .in('id', storyUserIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Get viewed stories
      const { data: viewedStories } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', user.id);

      const viewedIds = new Set(viewedStories?.map(v => v.story_id) || []);

      // Group stories by user
      const grouped: Record<string, StoryGroup> = {};
      
      stories?.forEach(story => {
        const userId = story.user_id;
        const profile = profilesMap.get(userId);
        if (!grouped[userId]) {
          grouped[userId] = {
            user_id: userId,
            username: profile?.username || '',
            avatar_url: profile?.avatar_url || null,
            is_verified: profile?.is_verified || false,
            stories: [],
            hasUnviewed: false,
          };
        }
        grouped[userId].stories.push({
          ...story,
          media_type: story.media_type as 'image' | 'video',
        });
        if (!viewedIds.has(story.id)) {
          grouped[userId].hasUnviewed = true;
        }
      });

      // Separate own stories and others
      if (grouped[user.id]) {
        setOwnStories(grouped[user.id]);
        delete grouped[user.id];
      } else {
        setOwnStories(null);
      }

      // Sort: unviewed first, then by most recent story
      const sortedGroups = Object.values(grouped).sort((a, b) => {
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return new Date(b.stories[0].created_at).getTime() - new Date(a.stories[0].created_at).getTime();
      });

      setStoryGroups(sortedGroups);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="border-b border-border py-4 bg-background/50 backdrop-blur-sm">
      <ScrollArea className="w-full">
        <div className="flex gap-4 px-4">
          {/* Own story / Create story */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {ownStories ? (
              <StoryRing
                hasUnviewed={false}
                isOwn
                size="lg"
                onClick={() => onViewStory(ownStories)}
              >
                <Avatar className="w-full h-full">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>{profile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </StoryRing>
            ) : (
              <button
                onClick={onCreateStory}
                className="w-20 h-20 rounded-full bg-muted flex items-center justify-center relative hover:bg-muted/80 transition-colors"
              >
                <Avatar className="w-[calc(100%-4px)] h-[calc(100%-4px)]">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>{profile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                  <Plus className="w-4 h-4 text-primary-foreground" />
                </div>
              </button>
            )}
            <span className="text-xs text-muted-foreground truncate max-w-[72px]">
              Your story
            </span>
          </div>

          {/* Other users' stories */}
          {storyGroups.map((group) => (
            <div key={group.user_id} className="flex flex-col items-center gap-1 shrink-0">
              <StoryRing
                hasUnviewed={group.hasUnviewed}
                size="lg"
                onClick={() => onViewStory(group)}
              >
                <Avatar className="w-full h-full">
                  <AvatarImage src={group.avatar_url || undefined} />
                  <AvatarFallback>{group.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </StoryRing>
              <span className="text-xs text-foreground truncate max-w-[72px]">
                {group.username}
              </span>
            </div>
          ))}

          {loading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1 shrink-0">
                  <div className="w-20 h-20 rounded-full bg-muted animate-pulse" />
                  <div className="w-12 h-3 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
