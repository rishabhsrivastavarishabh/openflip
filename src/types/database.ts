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

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
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
