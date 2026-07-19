-- Drop the overly permissive story SELECT policy
DROP POLICY IF EXISTS "Active stories viewable by authenticated" ON public.stories;

-- Replace with a privacy-aware SELECT policy
CREATE POLICY "Stories are viewable based on privacy"
ON public.stories FOR SELECT
USING (
  expires_at > now()
  AND (
    -- Owner can always see their own stories
    auth.uid() = user_id
    OR (
      -- Public stories: visible if the profile is public, or the viewer follows the owner
      visibility = 'public'
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = stories.user_id
          AND (profiles.is_private = false OR profiles.is_private IS NULL)
        )
        OR EXISTS (
          SELECT 1 FROM public.follows
          WHERE follows.following_id = stories.user_id
          AND follows.follower_id = auth.uid()
        )
      )
    )
    OR (
      -- Close-friends stories: visible only to close friends
      visibility = 'close_friends'
      AND EXISTS (
        SELECT 1 FROM public.close_friends
        WHERE close_friends.user_id = stories.user_id
        AND close_friends.friend_id = auth.uid()
      )
    )
  )
);