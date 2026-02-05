 import { useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 
 // Hook to track content analytics in real-time
 export function useContentAnalytics() {
   const { user } = useAuth();
 
   useEffect(() => {
     if (!user) return;
 
     // Subscribe to likes changes
     const likesChannel = supabase
       .channel('likes-analytics')
       .on(
         'postgres_changes',
         { event: '*', schema: 'public', table: 'likes' },
         async (payload) => {
           if (payload.eventType === 'INSERT') {
             const postId = payload.new.post_id;
             await updatePostAnalytics(postId, 'likes', 1);
           } else if (payload.eventType === 'DELETE') {
             const postId = payload.old.post_id;
             await updatePostAnalytics(postId, 'likes', -1);
           }
         }
       )
       .subscribe();
 
     // Subscribe to comments changes
     const commentsChannel = supabase
       .channel('comments-analytics')
       .on(
         'postgres_changes',
         { event: '*', schema: 'public', table: 'comments' },
         async (payload) => {
           if (payload.eventType === 'INSERT') {
             const postId = payload.new.post_id;
             await updatePostAnalytics(postId, 'comments', 1);
           } else if (payload.eventType === 'DELETE') {
             const postId = payload.old.post_id;
             await updatePostAnalytics(postId, 'comments', -1);
           }
         }
       )
       .subscribe();
 
     // Subscribe to saves changes
     const savesChannel = supabase
       .channel('saves-analytics')
       .on(
         'postgres_changes',
         { event: '*', schema: 'public', table: 'saves' },
         async (payload) => {
           if (payload.eventType === 'INSERT') {
             const postId = payload.new.post_id;
             await updatePostAnalytics(postId, 'saves', 1);
           } else if (payload.eventType === 'DELETE') {
             const postId = payload.old.post_id;
             await updatePostAnalytics(postId, 'saves', -1);
           }
         }
       )
       .subscribe();
 
     // Subscribe to reel likes
     const reelLikesChannel = supabase
       .channel('reel-likes-analytics')
       .on(
         'postgres_changes',
         { event: '*', schema: 'public', table: 'reel_likes' },
         async (payload) => {
           if (payload.eventType === 'INSERT') {
             const reelId = payload.new.reel_id;
             await updateReelAnalytics(reelId, 'likes', 1);
           } else if (payload.eventType === 'DELETE') {
             const reelId = payload.old.reel_id;
             await updateReelAnalytics(reelId, 'likes', -1);
           }
         }
       )
       .subscribe();
 
     return () => {
       likesChannel.unsubscribe();
       commentsChannel.unsubscribe();
       savesChannel.unsubscribe();
       reelLikesChannel.unsubscribe();
     };
   }, [user]);
 }
 
 async function updatePostAnalytics(postId: string, field: string, delta: number) {
   try {
     // Get the post owner
     const { data: post } = await supabase
       .from('posts')
       .select('user_id')
       .eq('id', postId)
       .single();
     
     if (!post) return;
 
     // Check if analytics record exists
     const { data: existing } = await supabase
       .from('content_analytics')
       .select('*')
       .eq('content_id', postId)
       .eq('content_type', 'post')
       .single();
 
     if (existing) {
       // Update existing record
       const updates: Record<string, number> = {};
       updates[field] = Math.max(0, (existing[field as keyof typeof existing] as number || 0) + delta);
       
       await supabase
         .from('content_analytics')
         .update({ ...updates, updated_at: new Date().toISOString() })
         .eq('id', existing.id);
     } else {
       // Create new record
       const newRecord = {
         content_id: postId,
         content_type: 'post',
         user_id: post.user_id,
         likes: field === 'likes' ? Math.max(0, delta) : 0,
         comments: field === 'comments' ? Math.max(0, delta) : 0,
         saves: field === 'saves' ? Math.max(0, delta) : 0,
         views: 0,
         unique_views: 0,
         shares: 0,
         reach: 0,
         profile_visits: 0,
         follows_gained: 0,
       };
       
       await supabase
         .from('content_analytics')
         .insert(newRecord);
     }
   } catch (error) {
     console.error('Error updating post analytics:', error);
   }
 }
 
 async function updateReelAnalytics(reelId: string, field: string, delta: number) {
   try {
     // Get the reel owner
     const { data: reel } = await supabase
       .from('reels')
       .select('user_id')
       .eq('id', reelId)
       .single();
     
     if (!reel) return;
 
     // Check if analytics record exists
     const { data: existing } = await supabase
       .from('content_analytics')
       .select('*')
       .eq('content_id', reelId)
       .eq('content_type', 'reel')
       .single();
 
     if (existing) {
       const updates: Record<string, number> = {};
       updates[field] = Math.max(0, (existing[field as keyof typeof existing] as number || 0) + delta);
       
       await supabase
         .from('content_analytics')
         .update({ ...updates, updated_at: new Date().toISOString() })
         .eq('id', existing.id);
     } else {
       const newRecord = {
         content_id: reelId,
         content_type: 'reel',
         user_id: reel.user_id,
         likes: field === 'likes' ? Math.max(0, delta) : 0,
         comments: field === 'comments' ? Math.max(0, delta) : 0,
         saves: field === 'saves' ? Math.max(0, delta) : 0,
         views: 0,
         unique_views: 0,
         shares: 0,
         reach: 0,
         profile_visits: 0,
         follows_gained: 0,
       };
       
       await supabase
         .from('content_analytics')
         .insert(newRecord);
     }
   } catch (error) {
     console.error('Error updating reel analytics:', error);
   }
 }
 
 // Track post view
 export async function trackContentView(contentId: string, contentType: 'post' | 'reel') {
   try {
     const tableName = contentType === 'post' ? 'posts' : 'reels';
     
     const { data: content } = await supabase
       .from(tableName)
       .select('user_id')
       .eq('id', contentId)
       .single();
     
     if (!content) return;
 
     const { data: existing } = await supabase
       .from('content_analytics')
       .select('*')
       .eq('content_id', contentId)
       .eq('content_type', contentType)
       .single();
 
     if (existing) {
       await supabase
         .from('content_analytics')
         .update({
           views: (existing.views || 0) + 1,
           unique_views: (existing.unique_views || 0) + 1,
           updated_at: new Date().toISOString(),
         })
         .eq('id', existing.id);
     } else {
       await supabase
         .from('content_analytics')
         .insert({
           content_id: contentId,
           content_type: contentType,
           user_id: content.user_id,
           views: 1,
           unique_views: 1,
         });
     }
   } catch (error) {
     console.error('Error tracking view:', error);
   }
 }