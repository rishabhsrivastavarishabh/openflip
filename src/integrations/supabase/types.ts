export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audience_insights: {
        Row: {
          age_range: string | null
          created_at: string
          follower_count: number
          gender: string | null
          id: string
          location: string | null
          recorded_at: string
          user_id: string
        }
        Insert: {
          age_range?: string | null
          created_at?: string
          follower_count?: number
          gender?: string | null
          id?: string
          location?: string | null
          recorded_at?: string
          user_id: string
        }
        Update: {
          age_range?: string | null
          created_at?: string
          follower_count?: number
          gender?: string | null
          id?: string
          location?: string | null
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      boost_campaigns: {
        Row: {
          actual_reach: number | null
          budget: number
          clicks: number | null
          content_id: string
          content_type: string
          created_at: string
          currency: string
          duration_days: number
          ends_at: string | null
          id: string
          impressions: number | null
          reach_estimate: number | null
          starts_at: string | null
          status: string
          target_audience: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_reach?: number | null
          budget: number
          clicks?: number | null
          content_id: string
          content_type: string
          created_at?: string
          currency?: string
          duration_days?: number
          ends_at?: string | null
          id?: string
          impressions?: number | null
          reach_estimate?: number | null
          starts_at?: string | null
          status?: string
          target_audience?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_reach?: number | null
          budget?: number
          clicks?: number | null
          content_id?: string
          content_type?: string
          created_at?: string
          currency?: string
          duration_days?: number
          ends_at?: string | null
          id?: string
          impressions?: number | null
          reach_estimate?: number | null
          starts_at?: string | null
          status?: string
          target_audience?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broadcast_followers: {
        Row: {
          channel_id: string
          followed_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          followed_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          followed_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_followers_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          answer: Json | null
          call_type: Database["public"]["Enums"]["call_type"]
          callee_id: string
          caller_id: string
          conversation_id: string | null
          created_at: string
          ended_at: string | null
          ice_candidates: Json | null
          id: string
          offer: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["call_status"]
          updated_at: string
        }
        Insert: {
          answer?: Json | null
          call_type?: Database["public"]["Enums"]["call_type"]
          callee_id: string
          caller_id: string
          conversation_id?: string | null
          created_at?: string
          ended_at?: string | null
          ice_candidates?: Json | null
          id?: string
          offer?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
        }
        Update: {
          answer?: Json | null
          call_type?: Database["public"]["Enums"]["call_type"]
          callee_id?: string
          caller_id?: string
          conversation_id?: string | null
          created_at?: string
          ended_at?: string | null
          ice_candidates?: Json | null
          id?: string
          offer?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_disabled: {
        Row: {
          conversation_id: string
          disabled_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          disabled_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          disabled_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_disabled_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      close_friends: {
        Row: {
          created_at: string | null
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_analytics: {
        Row: {
          comments: number
          content_id: string
          content_type: string
          created_at: string
          follows_gained: number
          id: string
          likes: number
          profile_visits: number
          reach: number
          recorded_at: string
          saves: number
          shares: number
          unique_views: number
          updated_at: string
          user_id: string
          views: number
        }
        Insert: {
          comments?: number
          content_id: string
          content_type: string
          created_at?: string
          follows_gained?: number
          id?: string
          likes?: number
          profile_visits?: number
          reach?: number
          recorded_at?: string
          saves?: number
          shares?: number
          unique_views?: number
          updated_at?: string
          user_id: string
          views?: number
        }
        Update: {
          comments?: number
          content_id?: string
          content_type?: string
          created_at?: string
          follows_gained?: number
          id?: string
          likes?: number
          profile_visits?: number
          reach?: number
          recorded_at?: string
          saves?: number
          shares?: number
          unique_views?: number
          updated_at?: string
          user_id?: string
          views?: number
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          archived_at: string | null
          can_post: boolean | null
          conversation_id: string
          is_admin: boolean | null
          is_archived: boolean
          is_pinned: boolean
          joined_at: string | null
          last_read_at: string | null
          pinned_at: string | null
          typing_at: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          can_post?: boolean | null
          conversation_id: string
          is_admin?: boolean | null
          is_archived?: boolean
          is_pinned?: boolean
          joined_at?: string | null
          last_read_at?: string | null
          pinned_at?: string | null
          typing_at?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          can_post?: boolean | null
          conversation_id?: string
          is_admin?: boolean | null
          is_archived?: boolean
          is_pinned?: boolean
          joined_at?: string | null
          last_read_at?: string | null
          pinned_at?: string | null
          typing_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          broadcast_description: string | null
          created_at: string | null
          created_by: string | null
          disappearing_messages_timer: number | null
          group_avatar_url: string | null
          group_name: string | null
          id: string
          is_broadcast: boolean | null
          is_group: boolean | null
          updated_at: string | null
        }
        Insert: {
          broadcast_description?: string | null
          created_at?: string | null
          created_by?: string | null
          disappearing_messages_timer?: number | null
          group_avatar_url?: string | null
          group_name?: string | null
          id?: string
          is_broadcast?: boolean | null
          is_group?: boolean | null
          updated_at?: string | null
        }
        Update: {
          broadcast_description?: string | null
          created_at?: string | null
          created_by?: string | null
          disappearing_messages_timer?: number | null
          group_avatar_url?: string | null
          group_name?: string | null
          id?: string
          is_broadcast?: boolean | null
          is_group?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      creator_earnings: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          earning_type: string
          id: string
          reference_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          earning_type: string
          id?: string
          reference_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          earning_type?: string
          id?: string
          reference_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_subscription_settings: {
        Row: {
          benefits: Json | null
          created_at: string
          currency: string
          id: string
          is_enabled: boolean
          monthly_price: number
          updated_at: string
          user_id: string
          yearly_price: number
        }
        Insert: {
          benefits?: Json | null
          created_at?: string
          currency?: string
          id?: string
          is_enabled?: boolean
          monthly_price?: number
          updated_at?: string
          user_id: string
          yearly_price?: number
        }
        Update: {
          benefits?: Json | null
          created_at?: string
          currency?: string
          id?: string
          is_enabled?: boolean
          monthly_price?: number
          updated_at?: string
          user_id?: string
          yearly_price?: number
        }
        Relationships: []
      }
      creator_subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          cancelled_at: string | null
          created_at: string
          creator_id: string
          currency: string
          expires_at: string | null
          id: string
          started_at: string
          status: string
          subscriber_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: string
          subscriber_id: string
          tier?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          cancelled_at?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: string
          subscriber_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string
          device_name: string
          device_public_key: string
          id: string
          last_seen_at: string
          prekey_bundle: Json | null
          signed_prekey_public: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string
          device_public_key: string
          id?: string
          last_seen_at?: string
          prekey_bundle?: Json | null
          signed_prekey_public?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string
          device_public_key?: string
          id?: string
          last_seen_at?: string
          prekey_bundle?: Json | null
          signed_prekey_public?: string | null
          user_id?: string
        }
        Relationships: []
      }
      drafts: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          location: string | null
          media_type: string | null
          media_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          media_type?: string | null
          media_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          media_type?: string | null
          media_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string | null
          id: string
          requester_id: string
          status: string
          target_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          requester_id: string
          status?: string
          target_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          requester_id?: string
          status?: string
          target_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      highlight_stories: {
        Row: {
          added_at: string | null
          highlight_id: string
          id: string
          story_id: string
        }
        Insert: {
          added_at?: string | null
          highlight_id: string
          id?: string
          story_id: string
        }
        Update: {
          added_at?: string | null
          highlight_id?: string
          id?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlight_stories_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "story_highlights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "highlight_stories_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_receipts: {
        Row: {
          delivered_at: string | null
          id: string
          message_id: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          delivered_at?: string | null
          id?: string
          message_id: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          delivered_at?: string | null
          id?: string
          message_id?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          aad: string | null
          ciphertext: string | null
          content: string
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          delivered_at: string | null
          edited_at: string | null
          expires_at: string | null
          file_name: string | null
          file_size: number | null
          id: string
          is_encrypted: boolean | null
          is_read: boolean | null
          is_view_once: boolean | null
          media_type: string | null
          media_url: string | null
          message_type: string | null
          nonce: string | null
          read_at: string | null
          reply_to_id: string | null
          sender_device_id: string | null
          sender_id: string
          shared_post_id: string | null
          shared_profile_id: string | null
          shared_reel_id: string | null
          status: string | null
          story_id: string | null
          story_reply_preview_url: string | null
          viewed_at: string | null
          voice_duration: number | null
        }
        Insert: {
          aad?: string | null
          ciphertext?: string | null
          content: string
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean | null
          is_view_once?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          nonce?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_device_id?: string | null
          sender_id: string
          shared_post_id?: string | null
          shared_profile_id?: string | null
          shared_reel_id?: string | null
          status?: string | null
          story_id?: string | null
          story_reply_preview_url?: string | null
          viewed_at?: string | null
          voice_duration?: number | null
        }
        Update: {
          aad?: string | null
          ciphertext?: string | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean | null
          is_view_once?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          nonce?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_device_id?: string | null
          sender_id?: string
          shared_post_id?: string | null
          shared_profile_id?: string | null
          shared_reel_id?: string | null
          status?: string | null
          story_id?: string | null
          story_reply_preview_url?: string | null
          viewed_at?: string | null
          voice_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_device_id_fkey"
            columns: ["sender_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          chat_notifications: boolean | null
          comment_notifications: boolean | null
          created_at: string | null
          follow_notifications: boolean | null
          id: string
          notification_sound: boolean | null
          ringtone: string | null
          story_like_notifications: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_notifications?: boolean | null
          comment_notifications?: boolean | null
          created_at?: string | null
          follow_notifications?: boolean | null
          id?: string
          notification_sound?: boolean | null
          ringtone?: string | null
          story_like_notifications?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_notifications?: boolean | null
          comment_notifications?: boolean | null
          created_at?: string | null
          follow_notifications?: boolean | null
          id?: string
          notification_sound?: boolean | null
          ringtone?: string | null
          story_like_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          post_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          status: string
          stripe_payment_intent_id: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          payment_details: Json | null
          payment_method: string | null
          processed_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          payment_details?: Json | null
          payment_method?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          payment_details?: Json | null
          payment_method?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_hashtags: {
        Row: {
          hashtag_id: string
          post_id: string
        }
        Insert: {
          hashtag_id: string
          post_id: string
        }
        Update: {
          hashtag_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string | null
          collaboration_status: string | null
          collaborator_id: string | null
          comments_enabled: boolean | null
          created_at: string | null
          id: string
          is_pinned: boolean | null
          likes_enabled: boolean | null
          location: string | null
          media_type: string
          media_url: string
          pinned_at: string | null
          sharing_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          collaboration_status?: string | null
          collaborator_id?: string | null
          comments_enabled?: boolean | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          likes_enabled?: boolean | null
          location?: string | null
          media_type: string
          media_url: string
          pinned_at?: string | null
          sharing_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          collaboration_status?: string | null
          collaborator_id?: string | null
          comments_enabled?: boolean | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          likes_enabled?: boolean | null
          location?: string | null
          media_type?: string
          media_url?: string
          pinned_at?: string | null
          sharing_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          account_type: string | null
          avatar_url: string | null
          bio: string | null
          business_category: string | null
          business_email: string | null
          business_website: string | null
          country_code: string | null
          cover_url: string | null
          created_at: string | null
          date_of_birth: string | null
          full_name: string | null
          gender: string | null
          id: string
          is_private: boolean | null
          is_verified: boolean | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          onboarding_completed: boolean
          phone_number: string | null
          suspended_until: string | null
          updated_at: string | null
          username: string
          verification_requested_at: string | null
          verification_status: string | null
          website: string | null
        }
        Insert: {
          account_status?: string
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_email?: string | null
          business_website?: string | null
          country_code?: string | null
          cover_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          is_private?: boolean | null
          is_verified?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          onboarding_completed?: boolean
          phone_number?: string | null
          suspended_until?: string | null
          updated_at?: string | null
          username: string
          verification_requested_at?: string | null
          verification_status?: string | null
          website?: string | null
        }
        Update: {
          account_status?: string
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_email?: string | null
          business_website?: string | null
          country_code?: string | null
          cover_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          is_private?: boolean | null
          is_verified?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          onboarding_completed?: boolean
          phone_number?: string | null
          suspended_until?: string | null
          updated_at?: string | null
          username?: string
          verification_requested_at?: string | null
          verification_status?: string | null
          website?: string | null
        }
        Relationships: []
      }
      promo_code_usage: {
        Row: {
          discount_applied: number
          id: string
          promo_code_id: string
          subscription_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          discount_applied: number
          id?: string
          promo_code_id: string
          subscription_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          discount_applied?: number
          id?: string
          promo_code_id?: string
          subscription_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_usage_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_uses: number
          discount_type: string
          discount_value: number
          expires_at: string | null
          first_time_only: boolean
          id: string
          is_active: boolean
          max_uses: number | null
          min_purchase_amount: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          discount_type: string
          discount_value: number
          expires_at?: string | null
          first_time_only?: boolean
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase_amount?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          first_time_only?: boolean
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_purchase_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reel_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_comments_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_likes: {
        Row: {
          created_at: string | null
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_likes_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_saves: {
        Row: {
          created_at: string | null
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_saves_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          audio_artist: string | null
          audio_name: string | null
          caption: string | null
          created_at: string | null
          duration: number | null
          id: string
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
          video_url: string
          view_count: number | null
        }
        Insert: {
          audio_artist?: string | null
          audio_name?: string | null
          caption?: string | null
          created_at?: string | null
          duration?: number | null
          id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
          video_url: string
          view_count?: number | null
        }
        Update: {
          audio_artist?: string | null
          audio_name?: string | null
          caption?: string | null
          created_at?: string | null
          duration?: number | null
          id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
          video_url?: string
          view_count?: number | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          action_taken: string | null
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_comment_id: string | null
          reported_message_id: string | null
          reported_post_id: string | null
          reported_reel_comment_id: string | null
          reported_reel_id: string | null
          reported_story_id: string | null
          reported_user_id: string | null
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_comment_id?: string | null
          reported_message_id?: string | null
          reported_post_id?: string | null
          reported_reel_comment_id?: string | null
          reported_reel_id?: string | null
          reported_story_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_comment_id?: string | null
          reported_message_id?: string | null
          reported_post_id?: string | null
          reported_reel_comment_id?: string | null
          reported_reel_id?: string | null
          reported_story_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_comment_id_fkey"
            columns: ["reported_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_message_id_fkey"
            columns: ["reported_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_post_id_fkey"
            columns: ["reported_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_reel_comment_id_fkey"
            columns: ["reported_reel_comment_id"]
            isOneToOne: false
            referencedRelation: "reel_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_reel_id_fkey"
            columns: ["reported_reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_story_id_fkey"
            columns: ["reported_story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      search_history: {
        Row: {
          created_at: string | null
          id: string
          query: string
          search_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          query: string
          search_type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          query?: string
          search_type?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          allow_reactions: boolean | null
          allow_replies: boolean | null
          created_at: string | null
          duration: number | null
          expires_at: string | null
          id: string
          media_type: string
          media_url: string
          user_id: string
          visibility: string
        }
        Insert: {
          allow_reactions?: boolean | null
          allow_replies?: boolean | null
          created_at?: string | null
          duration?: number | null
          expires_at?: string | null
          id?: string
          media_type: string
          media_url: string
          user_id: string
          visibility?: string
        }
        Update: {
          allow_reactions?: boolean | null
          allow_replies?: boolean | null
          created_at?: string | null
          duration?: number | null
          expires_at?: string | null
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      story_highlights: {
        Row: {
          cover_url: string | null
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string | null
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string | null
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string | null
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price_monthly: number
          price_yearly: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price_monthly: number
          price_yearly: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tips: {
        Row: {
          amount: number
          created_at: string
          creator_amount: number
          creator_id: string
          currency: string
          id: string
          message: string | null
          platform_fee: number
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          creator_amount: number
          creator_id: string
          currency?: string
          id?: string
          message?: string | null
          platform_fee?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          creator_amount?: number
          creator_id?: string
          currency?: string
          id?: string
          message?: string | null
          platform_fee?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_online_status: {
        Row: {
          id: string
          is_online: boolean | null
          last_seen_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_online?: boolean | null
          last_seen_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_cycle?: string
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          business_email: string | null
          business_name: string | null
          category: string
          created_at: string
          document_type: string | null
          document_url: string | null
          government_id_url: string | null
          id: string
          notes: string | null
          request_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_email?: string | null
          business_name?: string | null
          category: string
          created_at?: string
          document_type?: string | null
          document_url?: string | null
          government_id_url?: string | null
          id?: string
          notes?: string | null
          request_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_email?: string | null
          business_name?: string | null
          category?: string
          created_at?: string
          document_type?: string | null
          document_url?: string | null
          government_id_url?: string | null
          id?: string
          notes?: string | null
          request_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_my_private_profile: {
        Args: never
        Returns: {
          business_email: string
          country_code: string
          date_of_birth: string
          gender: string
          phone_number: string
        }[]
      }
      get_recipient_device_public_key: {
        Args: { _user_id: string }
        Returns: {
          device_public_key: string
          id: string
        }[]
      }
      has_active_subscription: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      lookup_email_by_identifier: {
        Args: { _identifier: string }
        Returns: string
      }
      lookup_user_id_by_identifier: {
        Args: { _identifier: string }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      validate_promo_code: {
        Args: { code_input: string; user_id_input: string }
        Returns: {
          discount_type: string
          discount_value: number
          error_message: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      call_status:
        | "ringing"
        | "accepted"
        | "declined"
        | "missed"
        | "ended"
        | "cancelled"
      call_type: "voice" | "video"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      call_status: [
        "ringing",
        "accepted",
        "declined",
        "missed",
        "ended",
        "cancelled",
      ],
      call_type: ["voice", "video"],
    },
  },
} as const
