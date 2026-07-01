import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Seo } from '@/components/seo/Seo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import openflipLogo from '@/assets/openflip-logo.png';

const schema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm: z.string().min(6, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    // Surface any error from the recovery link (expired/invalid token, etc.)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const errDesc =
      hashParams.get('error_description') || searchParams.get('error_description');
    if (errDesc) {
      toast.error(decodeURIComponent(errDesc.replace(/\+/g, ' ')));
    }

    // PKCE flow: Supabase redirects here with ?code=... — exchange it for a session.
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          toast.error(error.message || 'Reset link is invalid or expired');
        } else {
          setReady(true);
          // Clean the code out of the URL
          window.history.replaceState({}, '', '/reset-password');
        }
      });
    }

    // Implicit flow: Supabase auto-exchanges the recovery token in the hash
    // and emits PASSWORD_RECOVERY. Either an active session or that event is enough.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to update password');
      return;
    }
    toast.success('Password updated! Please sign in.');
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Seo title="Reset password — Openflip" description="Set a new password for your Openflip account." path="/reset-password" />
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img src={openflipLogo} alt="Openflip" className="h-12 mx-auto mb-6" />
          <h1 className="text-2xl font-display font-bold">Set a new password</h1>
          <p className="text-muted-foreground mt-2">
            {ready ? 'Choose a strong password you haven\'t used before.' : 'Validating your reset link…'}
          </p>
        </div>

        {ready && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10"
                  {...form.register('confirm')}
                />
              </div>
              {form.formState.errors.confirm && (
                <p className="text-sm text-destructive">{form.formState.errors.confirm.message}</p>
              )}
            </div>

            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
