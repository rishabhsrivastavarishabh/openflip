import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Star, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentCheckout } from '@/components/payment/PaymentCheckout';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  creatorId: string;
  creatorName: string;
}

interface Settings {
  is_enabled: boolean;
  monthly_price: number;
  yearly_price: number;
  benefits?: any;
}

export function CreatorSubscribeDialog({ open, onOpenChange, creatorId, creatorName }: Props) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'plans' | 'pay'>('plans');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('creator_subscription_settings')
        .select('*')
        .eq('user_id', creatorId)
        .maybeSingle();
      setSettings(data);

      const { data: sub } = await (supabase as any)
        .from('creator_subscriptions')
        .select('id')
        .eq('creator_id', creatorId)
        .eq('subscriber_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      setIsSubscribed(!!sub);
      setLoading(false);
    })();
  }, [open, user, creatorId]);

  const amount = cycle === 'yearly' ? settings?.yearly_price || 0 : settings?.monthly_price || 0;
  const defaultBenefits = ['Exclusive posts', 'Exclusive reels', 'Subscriber-only stories', 'Badge on comments'];
  const benefits: string[] = Array.isArray(settings?.benefits) ? settings!.benefits : defaultBenefits;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setStep('plans'); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !settings?.is_enabled ? (
          <div className="text-center py-8 space-y-2">
            <Crown className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="font-medium">@{creatorName} isn't accepting subscriptions yet.</p>
          </div>
        ) : isSubscribed ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
              <Crown className="w-6 h-6 text-primary-foreground" />
            </div>
            <p className="font-semibold">You're already a subscriber ✨</p>
            <p className="text-sm text-muted-foreground">You have full access to @{creatorName}'s exclusive content.</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : step === 'plans' ? (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center mb-2 shadow-glow">
                <Crown className="w-6 h-6 text-primary-foreground" />
              </div>
              <DialogTitle>Subscribe to @{creatorName}</DialogTitle>
              <DialogDescription>Get exclusive posts, reels, and more.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCycle('monthly')}
                  className={`p-4 rounded-2xl border text-left transition-all ${cycle === 'monthly' ? 'border-primary bg-primary/5 shadow-glow' : 'border-border hover:border-primary/40'}`}
                >
                  <div className="text-xs text-muted-foreground">Monthly</div>
                  <div className="text-2xl font-bold">₹{settings.monthly_price}</div>
                  <div className="text-xs text-muted-foreground">per month</div>
                </button>
                <button
                  onClick={() => setCycle('yearly')}
                  className={`p-4 rounded-2xl border text-left transition-all relative ${cycle === 'yearly' ? 'border-primary bg-primary/5 shadow-glow' : 'border-border hover:border-primary/40'}`}
                >
                  <div className="text-xs text-muted-foreground">Yearly</div>
                  <div className="text-2xl font-bold">₹{settings.yearly_price}</div>
                  <div className="text-xs text-muted-foreground">per year</div>
                  {settings.yearly_price < settings.monthly_price * 12 && (
                    <span className="absolute -top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold">
                      Save {Math.round((1 - settings.yearly_price / (settings.monthly_price * 12)) * 100)}%
                    </span>
                  )}
                </button>
              </div>

              <div className="space-y-1.5 p-3 rounded-xl bg-secondary/40">
                {benefits.map(b => (
                  <div key={b} className="flex items-center gap-2 text-sm">
                    <Star className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <Button variant="gradient" className="w-full" onClick={() => setStep('pay')}>
                Continue · ₹{amount}
              </Button>
            </div>
          </>
        ) : (
          <PaymentCheckout
            amount={amount}
            description={`Subscribe to @${creatorName} (${cycle})`}
            type={'creator_subscription' as any}
            billingCycle={cycle}
            metadata={{ creator_id: creatorId, tier: 'standard' }}
            onSuccess={() => { toast.success('Subscribed!'); setStep('plans'); onOpenChange(false); }}
            onCancel={() => setStep('plans')}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
