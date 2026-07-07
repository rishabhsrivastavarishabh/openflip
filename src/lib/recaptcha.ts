import { supabase } from '@/integrations/supabase/client';

export async function verifyRecaptchaToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  const { data, error } = await supabase.functions.invoke('verify-recaptcha', {
    body: { token },
  });
  if (error) return false;
  return !!data?.success;
}
