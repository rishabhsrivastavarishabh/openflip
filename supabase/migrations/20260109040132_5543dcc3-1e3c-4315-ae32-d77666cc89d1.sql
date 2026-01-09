-- Create drafts table for auto-save functionality
CREATE TABLE public.drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  caption TEXT,
  media_url TEXT,
  media_type TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on drafts
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own drafts
CREATE POLICY "Users can manage own drafts" ON public.drafts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add pinned column to posts table
ALTER TABLE public.posts ADD COLUMN is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.posts ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE;

-- Create search_history table
CREATE TABLE public.search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  search_type TEXT NOT NULL DEFAULT 'all',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on search_history
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own search history
CREATE POLICY "Users can manage own search history" ON public.search_history
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create function to limit pinned posts to 3
CREATE OR REPLACE FUNCTION public.check_pinned_posts_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_pinned = true THEN
    IF (SELECT COUNT(*) FROM posts WHERE user_id = NEW.user_id AND is_pinned = true AND id != NEW.id) >= 3 THEN
      RAISE EXCEPTION 'Cannot pin more than 3 posts';
    END IF;
    NEW.pinned_at = now();
  ELSE
    NEW.pinned_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for pinned posts limit
CREATE TRIGGER check_pinned_posts_limit_trigger
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_pinned_posts_limit();

-- Add trigger for drafts updated_at
CREATE TRIGGER update_drafts_updated_at
  BEFORE UPDATE ON public.drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();