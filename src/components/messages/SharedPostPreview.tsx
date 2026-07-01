import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Image, Film, User } from 'lucide-react';

interface SharedPostPreviewProps {
  postId?: string;
  reelId?: string;
  profileId?: string;
  isMine?: boolean;
}

interface PostData {
  id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface ReelData {
  id: string;
  thumbnail_url: string | null;
  video_url: string;
  caption: string | null;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

interface ProfileData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export function SharedPostPreview({ postId, reelId, profileId, isMine }: SharedPostPreviewProps) {
  const [post, setPost] = useState<PostData | null>(null);
  const [reel, setReel] = useState<ReelData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (postId) {
          const { data } = await supabase
            .from('posts')
            .select('id, media_url, media_type, caption, profiles:user_id(username, avatar_url)')
            .eq('id', postId)
            .single();
          setPost(data as unknown as PostData);
        } else if (reelId) {
          const { data } = await supabase
            .from('reels')
            .select('id, thumbnail_url, video_url, caption, profiles:user_id(username, avatar_url)')
            .eq('id', reelId)
            .single();
          setReel(data as unknown as ReelData);
        } else if (profileId) {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url, bio')
            .eq('id', profileId)
            .single();
          setProfile(data as ProfileData);
        }
      } catch (error) {
        console.error('Error fetching shared content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [postId, reelId, profileId]);

  if (loading) {
    return (
      <div className={cn(
        "w-48 h-32 rounded-lg animate-pulse",
        isMine ? "bg-primary-foreground/20" : "bg-muted"
      )} />
    );
  }

  if (post) {
    return (
      <Link
        to={`/post/${post.id}`}
        className={cn(
          "block w-48 rounded-lg overflow-hidden border",
          isMine ? "border-primary-foreground/20" : "border-border"
        )}
      >
        <div className="relative aspect-square">
          {post.media_type === 'video' ? (
            <video
              src={post.media_url}
              className="w-full h-full object-cover"
              muted
            />
          ) : (
            <img
              src={post.media_url}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute top-2 right-2">
            {post.media_type === 'video' ? (
              <Film className="w-4 h-4 text-white drop-shadow-lg" />
            ) : (
              <Image className="w-4 h-4 text-white drop-shadow-lg" />
            )}
          </div>
        </div>
        <div className={cn(
          "p-2",
          isMine ? "bg-primary-foreground/10" : "bg-muted"
        )}>
          <p className={cn(
            "text-xs font-medium",
            isMine ? "text-primary-foreground" : "text-foreground"
          )}>
            @{post.profiles.username}
          </p>
          {post.caption && (
            <p className={cn(
              "text-xs truncate mt-0.5",
              isMine ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {post.caption}
            </p>
          )}
        </div>
      </Link>
    );
  }

  if (reel) {
    return (
      <Link
        to={`/reels?id=${reel.id}`}
        className={cn(
          "block w-32 rounded-lg overflow-hidden border",
          isMine ? "border-primary-foreground/20" : "border-border"
        )}
      >
        <div className="relative aspect-[9/16]">
          {reel.thumbnail_url ? (
            <img
              src={reel.thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={reel.video_url}
              className="w-full h-full object-cover"
              muted
            />
          )}
          <div className="absolute top-2 right-2">
            <Film className="w-4 h-4 text-white drop-shadow-lg" />
          </div>
        </div>
      </Link>
    );
  }

  if (profile) {
    return (
      <Link
        to={`/profile/${profile.username}`}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border",
          isMine ? "border-primary-foreground/20 bg-primary-foreground/10" : "border-border bg-muted"
        )}
      >
        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium",
            isMine ? "text-primary-foreground" : "text-foreground"
          )}>
            @{profile.username}
          </p>
          {profile.full_name && (
            <p className={cn(
              "text-sm truncate",
              isMine ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {profile.full_name}
            </p>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className={cn(
      "p-3 rounded-lg text-sm",
      isMine ? "bg-primary-foreground/10 text-primary-foreground/70" : "bg-muted text-muted-foreground"
    )}>
      Content unavailable
    </div>
  );
}
