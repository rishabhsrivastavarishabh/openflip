import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, ArrowLeft, Phone, Camera, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo/Seo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiAccount } from '@/contexts/MultiAccountContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import openflipLogo from '@/assets/openflip-logo.png';
import { LoginMfaChallenge } from '@/components/auth/LoginMfaChallenge';
import { Recaptcha } from '@/components/auth/Recaptcha';
import { verifyRecaptchaToken } from '@/lib/recaptcha';
import { isDeviceTrusted } from '@/lib/trustedDevice';

const countryCodes = [
  { code: '+1', country: 'US' }, { code: '+44', country: 'UK' }, { code: '+91', country: 'IN' },
  { code: '+86', country: 'CN' }, { code: '+81', country: 'JP' }, { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' }, { code: '+39', country: 'IT' }, { code: '+55', country: 'BR' },
  { code: '+7', country: 'RU' }, { code: '+82', country: 'KR' }, { code: '+61', country: 'AU' },
  { code: '+34', country: 'ES' }, { code: '+52', country: 'MX' }, { code: '+971', country: 'AE' },
  { code: '+966', country: 'SA' }, { code: '+65', country: 'SG' }, { code: '+60', country: 'MY' },
  { code: '+62', country: 'ID' }, { code: '+63', country: 'PH' }, { code: '+84', country: 'VN' },
  { code: '+66', country: 'TH' }, { code: '+27', country: 'ZA' }, { code: '+234', country: 'NG' },
  { code: '+20', country: 'EG' }, { code: '+254', country: 'KE' }, { code: '+92', country: 'PK' },
  { code: '+880', country: 'BD' },
];

const signInSchema = z.object({
  identifier: z.string().min(1, 'Please enter email, username, or phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  fullName: z.string().optional(),
  phoneNumber: z.string().optional(),
  countryCode: z.string().optional(),
  agreeTerms: z.literal(true, { errorMap: () => ({ message: 'You must agree to the Privacy Policy & Terms' }) }),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type SignInForm = z.infer<typeof signInSchema>;
type SignUpForm = z.infer<typeof signUpSchema>;
type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [signupStep, setSignupStep] = useState(1); // 1: basic, 2: DOB, 3: photo, 4: confirm
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dob, setDob] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [signupUserId, setSignupUserId] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; userId: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { signIn, signUp } = useAuth();
  const { saveCurrentSession, accounts } = useMultiAccount();
  const navigate = useNavigate();

  // Prefill the identifier with the most recently used stored account so the
  // Switch Account flow lands on a familiar login.
  const mostRecentAccount = accounts.length
    ? [...accounts].sort((a, b) => b.lastUsed - a.lastUsed)[0]
    : null;

  const signInForm = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: mostRecentAccount?.username ?? '', password: '' },
  });
  const signUpForm = useForm<SignUpForm>({ resolver: zodResolver(signUpSchema) });
  const forgotPasswordForm = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) });

  const handleForgotPassword = async (data: ForgotPasswordForm) => {
    if (!(await verifyRecaptchaToken(captchaToken))) {
      setCaptchaToken(null);
      toast.error('Please complete the reCAPTCHA challenge');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setCaptchaToken(null);
    if (error) {
      toast.error(error.message || 'Failed to send reset email');
    } else {
      toast.success('Password reset email sent! Check your inbox.');
      setMode('signin');
    }
  };




  const handleSignIn = async (data: SignInForm) => {
    setLoading(true);
    let email = data.identifier.trim();
    if (!email.includes('@')) {
      // Look up the email for a username or phone number via a secure RPC.
      // The old flow tried supabase.auth.admin.getUserById from the client, which
      // requires the service_role key and always fails in the browser — that's
      // what broke sign-in for anyone not using their email address.
      const { data: foundEmail, error: lookupErr } = await supabase.rpc(
        'lookup_email_by_identifier' as any,
        { _identifier: email },
      );
      if (lookupErr || !foundEmail) {
        toast.error("We couldn't find an account with that username or phone number.");
        setLoading(false);
        return;
      }
      email = foundEmail as string;
    }

    const { error } = await signIn(email, data.password);
    if (error) {
      setLoading(false);
      toast.error(error.message || 'Failed to sign in');
      return;
    }

    // Enforce 2FA for enrolled users (unless this device is trusted)
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = (factorsData?.totp ?? []).find((f: any) => f.status === 'verified');
      const { data: sessionData } = await supabase.auth.getUser();
      if (verifiedTotp && sessionData?.user) {
        if (!isDeviceTrusted(sessionData.user.id, verifiedTotp.id)) {
          setLoading(false);
          setMfaChallenge({ factorId: verifiedTotp.id, userId: sessionData.user.id });
          return;
        }
      }
    } catch (e) {
      console.warn('MFA check failed, proceeding', e);
    }

    // Explicitly save this account into the multi-account switcher list so
    // the "Switch Account" flow works reliably even when the auth listener
    // misses the SIGNED_IN event.
    await saveCurrentSession();

    setLoading(false);
    toast.success('Welcome back!');
    // Honor an OAuth consent redirect if present.
    const nextParam = new URLSearchParams(window.location.search).get('next');
    if (nextParam && nextParam.startsWith('/')) {
      navigate(nextParam);
    } else {
      navigate('/');
    }
  };

  const handleSignUpStep1 = async (data: SignUpForm) => {
    if (!captchaToken) {
      toast.error('Please complete the reCAPTCHA challenge');
      return;
    }
    setLoading(true);
    const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-recaptcha', {
      body: { token: captchaToken },
    });
    if (verifyError || !verifyData?.success) {
      setLoading(false);
      setCaptchaToken(null);
      toast.error('reCAPTCHA verification failed. Please try again.');
      return;
    }
    const { error } = await signUp(data.email, data.password, data.username, data.fullName);
    if (!error && data.phoneNumber && data.countryCode) {
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        await supabase.from('profiles').update({
          phone_number: data.phoneNumber,
          country_code: data.countryCode,
        }).eq('id', newUser.id);
        setSignupUserId(newUser.id);
      }
    } else if (!error) {
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) setSignupUserId(newUser.id);
    }
    setLoading(false);
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } else {
      setSignupStep(2);
    }
  };

  const handleDobSubmit = async () => {
    if (!dob) {
      toast.error('Please enter your date of birth');
      return;
    }
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    if (age < 13) {
      toast.error('You must be at least 13 years old to use Openflip');
      return;
    }
    if (signupUserId) {
      await supabase.from('profiles').update({ date_of_birth: dob }).eq('id', signupUserId);
    }
    setSignupStep(3);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!avatarFile || !signupUserId) {
      setSignupStep(4);
      return;
    }
    setLoading(true);
    try {
      const fileName = `${signupUserId}/avatar.png`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, avatarFile, { upsert: true, contentType: avatarFile.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: `${publicUrl}?t=${Date.now()}` }).eq('id', signupUserId);
    } catch (error: any) {
      toast.error('Photo upload failed, you can add it later from settings');
    }
    setLoading(false);
    setSignupStep(4);
  };

  const handleFinishSignup = async () => {
    // Persist the newly-created account into the multi-account switcher.
    await saveCurrentSession();
    toast.success('Welcome to Openflip! 🎉');
    navigate('/');
  };

  const stepVariants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  return (
    <main className="min-h-screen flex flex-col lg:flex-row">
      <Seo title="Sign in or create an account — Openflip" description="Join Openflip to share photos, short videos, and connect with creators." path="/auth" />
      <h1 className="sr-only">Sign in or create your Openflip account</h1>
      {/* Left branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <img src={openflipLogo} alt="Openflip — secure social network logo" className="h-16 mx-auto mb-8" />
            <h2 className="text-4xl font-display font-bold text-primary-foreground mb-4">Welcome to Openflip</h2>
            <p className="text-primary-foreground/80 text-lg max-w-md mx-auto">
              Share moments, connect with friends, and discover amazing content from creators around the world.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <img src={openflipLogo} alt="Openflip — secure social network logo" className="h-12 mx-auto" />
          </div>

          <AnimatePresence mode="wait">
            {mode === 'forgot' ? (
              <motion.div key="forgot" {...stepVariants} className="space-y-6">
                <div className="text-center lg:text-left">
                  <h2 className="text-2xl font-display font-bold">Reset password</h2>
                  <p className="text-muted-foreground mt-2">Enter your email to receive a reset link</p>
                </div>
                <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input id="email" type="email" placeholder="you@example.com" className="pl-10" {...forgotPasswordForm.register('email')} />
                    </div>
                    {forgotPasswordForm.formState.errors.email && <p className="text-sm text-destructive">{forgotPasswordForm.formState.errors.email.message}</p>}
                  </div>
                  <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
                    {loading ? 'Sending...' : 'Send reset link'}<ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setMode('signin')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />Back to sign in
                  </Button>
                </form>
              </motion.div>
            ) : mode === 'signup' ? (
              <motion.div key={`signup-${signupStep}`} {...stepVariants} className="space-y-6">
                {signupStep === 1 && (
                  <>
                    <div className="text-center lg:text-left">
                      <h2 className="text-2xl font-display font-bold">Create your account</h2>
                      <p className="text-muted-foreground mt-2">Step 1 of 4 — Basic info</p>
                    </div>
                    <form onSubmit={signUpForm.handleSubmit(handleSignUpStep1)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name (optional)</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input id="fullName" placeholder="John Doe" className="pl-10" {...signUpForm.register('fullName')} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                          <Input id="username" placeholder="johndoe" className="pl-8" {...signUpForm.register('username')} />
                        </div>
                        {signUpForm.formState.errors.username && <p className="text-sm text-destructive">{signUpForm.formState.errors.username.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input id="email" type="email" placeholder="you@example.com" className="pl-10" {...signUpForm.register('email')} />
                        </div>
                        {signUpForm.formState.errors.email && <p className="text-sm text-destructive">{signUpForm.formState.errors.email.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="pl-10 pr-10" {...signUpForm.register('password')} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        {signUpForm.formState.errors.password && <p className="text-sm text-destructive">{signUpForm.formState.errors.password.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone (optional)</Label>
                        <div className="flex gap-2">
                          <Select onValueChange={(value) => signUpForm.setValue('countryCode', value)} defaultValue="+1">
                            <SelectTrigger className="w-24"><SelectValue placeholder="+1" /></SelectTrigger>
                            <SelectContent className="bg-background border">
                              {countryCodes.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} {c.country}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <div className="relative flex-1">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input id="phone" type="tel" placeholder="1234567890" className="pl-10" {...signUpForm.register('phoneNumber')} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" id="agreeTerms" className="mt-1 rounded border-border" {...signUpForm.register('agreeTerms')} />
                        <label htmlFor="agreeTerms" className="text-sm text-muted-foreground">
                          I agree to the <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>{' & '}
                          <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                        </label>
                      </div>
                      {signUpForm.formState.errors.agreeTerms && <p className="text-sm text-destructive">{signUpForm.formState.errors.agreeTerms.message}</p>}
                      <Recaptcha onVerify={setCaptchaToken} />
                      <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading || !captchaToken}>
                        {loading ? 'Creating...' : 'Continue'}<ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </form>
                  </>
                )}

                {signupStep === 2 && (
                  <>
                    <div className="text-center">
                      <Calendar className="w-12 h-12 text-primary mx-auto mb-4" />
                      <h2 className="text-2xl font-display font-bold">Date of Birth</h2>
                      <p className="text-muted-foreground mt-2">Step 2 of 4 — We need this to personalize your experience</p>
                    </div>
                    <div className="space-y-4">
                      <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="text-center text-lg" max={new Date().toISOString().split('T')[0]} />
                      <Button variant="gradient" size="lg" className="w-full" onClick={handleDobSubmit}>
                        Continue<ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>
                  </>
                )}

                {signupStep === 3 && (
                  <>
                    <div className="text-center">
                      <h2 className="text-2xl font-display font-bold">Profile Photo</h2>
                      <p className="text-muted-foreground mt-2">Step 3 of 4 — Add a profile picture</p>
                    </div>
                    <div className="flex flex-col items-center space-y-6">
                      <div className="relative">
                        <Avatar className="w-32 h-32">
                          <AvatarImage src={avatarPreview || undefined} />
                          <AvatarFallback className="text-4xl bg-primary/10 text-primary">
                            <Camera className="w-8 h-8" />
                          </AvatarFallback>
                        </Avatar>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                        >
                          <Camera className="w-5 h-5" />
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                      </div>
                      <Button variant="gradient" size="lg" className="w-full" onClick={handlePhotoUpload} disabled={loading}>
                        {loading ? 'Uploading...' : avatarFile ? 'Upload & Continue' : 'Skip for now'}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </div>
                  </>
                )}

                {signupStep === 4 && (
                  <>
                    <div className="text-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <User className="w-10 h-10 text-primary" />
                        </div>
                      </motion.div>
                      <h2 className="text-2xl font-display font-bold">You're all set!</h2>
                      <p className="text-muted-foreground mt-2">
                        Welcome, <span className="font-semibold text-foreground">@{signUpForm.getValues('username')}</span>
                      </p>
                    </div>
                    <Button variant="gradient" size="lg" className="w-full" onClick={handleFinishSignup}>
                      Start exploring<ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div key="signin" {...stepVariants} className="space-y-6">
                <div className="text-center lg:text-left">
                  <h2 className="text-2xl font-display font-bold">Welcome back</h2>
                  <p className="text-muted-foreground mt-2">Sign in to continue to Openflip</p>
                </div>
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="identifier">Email, Username, or Phone</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input id="identifier" type="text" placeholder="Email, @username, or phone" className="pl-10" {...signInForm.register('identifier')} />
                    </div>
                    {signInForm.formState.errors.identifier && <p className="text-sm text-destructive">{signInForm.formState.errors.identifier.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button type="button" onClick={() => setMode('forgot')} className="text-sm text-primary hover:underline">Forgot password?</button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="pl-10 pr-10" {...signInForm.register('password')} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {signInForm.formState.errors.password && <p className="text-sm text-destructive">{signInForm.formState.errors.password.message}</p>}
                  </div>
                  <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}<ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </form>


                <div className="text-center text-sm text-muted-foreground">
                  <Link to="/privacy" className="hover:text-primary">Privacy</Link>
                  <span className="mx-2">·</span>
                  <Link to="/terms" className="hover:text-primary">Terms</Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {mode !== 'forgot' && signupStep === 1 && (
            <div className="text-center mt-6">
              <button
                onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setSignupStep(1); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {mode === 'signup' ? (
                  <>Already have an account? <span className="font-semibold text-primary">Sign in</span></>
                ) : (
                  <>Don't have an account? <span className="font-semibold text-primary">Sign up</span></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {mfaChallenge && (
        <LoginMfaChallenge
          open={true}
          factorId={mfaChallenge.factorId}
          userId={mfaChallenge.userId}
          onVerified={() => {
            setMfaChallenge(null);
            toast.success('Welcome back!');
            navigate('/');
          }}
          onCancel={() => {
            setMfaChallenge(null);
            toast.message('Signed out. Please sign in again.');
          }}
        />
      )}
    </main>
  );
}
