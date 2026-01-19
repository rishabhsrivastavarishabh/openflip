-- Add phone number field to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '+1';

-- Add request_id to verification_requests
ALTER TABLE public.verification_requests 
ADD COLUMN IF NOT EXISTS request_id TEXT UNIQUE;

-- Create function to generate unique request ID
CREATE OR REPLACE FUNCTION public.generate_verification_request_id()
RETURNS TRIGGER AS $$
DECLARE
    new_request_id TEXT;
BEGIN
    -- Generate a unique request ID like VR-YYYYMMDD-XXXX
    new_request_id := 'VR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.verification_requests WHERE request_id = new_request_id) LOOP
        new_request_id := 'VR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END LOOP;
    
    NEW.request_id := new_request_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-generating request ID
DROP TRIGGER IF EXISTS generate_verification_request_id_trigger ON public.verification_requests;
CREATE TRIGGER generate_verification_request_id_trigger
    BEFORE INSERT ON public.verification_requests
    FOR EACH ROW
    WHEN (NEW.request_id IS NULL)
    EXECUTE FUNCTION public.generate_verification_request_id();

-- Update existing verification_requests to have request_id
UPDATE public.verification_requests 
SET request_id = 'VR-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
WHERE request_id IS NULL;

-- Create reel_saves table for saving reels
CREATE TABLE IF NOT EXISTS public.reel_saves (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reel_id UUID NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(reel_id, user_id)
);

-- Enable RLS on reel_saves
ALTER TABLE public.reel_saves ENABLE ROW LEVEL SECURITY;

-- RLS policies for reel_saves
CREATE POLICY "Users can view their own saves" ON public.reel_saves
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create saves" ON public.reel_saves
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saves" ON public.reel_saves
    FOR DELETE USING (auth.uid() = user_id);