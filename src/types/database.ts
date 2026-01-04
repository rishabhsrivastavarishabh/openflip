export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  is_private: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  location: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  likes?: Like[];
  comments?: Comment[];
  saves?: Save[];
  _count?: {
    likes: number;
    comments: number;
  };
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface Save {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface FollowRequest {
  id: string;
  requester_id: string;
  target_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accepted' | 'mention' | 'message';
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  profiles?: Profile;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  profiles?: Profile;
}

export interface Hashtag {
  id: string;
  name: string;
  created_at: string;
}

// Stories types
export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  duration: number;
  created_at: string;
  expires_at: string;
  profiles?: Profile;
}

export interface StoryView {
  id: string;
  story_id: string;
  viewer_id: string;
  viewed_at: string;
  profiles?: Profile;
}

export interface StoryGroup {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean;
  stories: Story[];
  hasUnviewed: boolean;
}

// Reels types
export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  audio_name: string | null;
  audio_artist: string | null;
  duration: number | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  isLiked?: boolean;
  likeCount?: number;
  commentCount?: number;
}

export interface ReelLike {
  id: string;
  reel_id: string;
  user_id: string;
  created_at: string;
}

export interface ReelComment {
  id: string;
  reel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

// Conversation participant with typing
export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  typing_at: string | null;
  last_read_at: string | null;
}
