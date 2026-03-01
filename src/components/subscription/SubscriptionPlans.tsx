import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Sparkles, Star, Zap, Tag, Loader2, Shield, BarChart3, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PaymentCheckout } from '@/components/payment/PaymentCheckout';

export interface PlanTier {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  icon: React.ReactNode;
  highlight?: boolean;
  badge?: string;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  'Free': <Zap className="w-5 h-5" />,
  'Starter': <Star className="w-5 h-5" />,
  'Creator': <Sparkles className="w-5 h-5" />,
  'Pro': <Rocket className="w-5 h-5" />,
  'Premium Verified': <Crown className="w-5 h-5" />,
};

const PLAN_BADGES: Record<string, string> = {
  'Creator': 'Popular',
  'Premium Verified': 'Best Value',
};

const PLAN_HIGHLIGHTS: Record<string, boolean> = {
  'Creator': true,
};

interface SubscriptionPlansProps {
  currentPlan?: string | null;
  onSubscribe?: () => void;
}

export function SubscriptionPlans({ currentPlan, onSubscribe }: SubscriptionPlansProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<PlanTier | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount_type?: string;
    discount_value?: number;
    discount_amount?: number;
    final_price?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (data) {
      setPlans(data.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price_monthly: p.price_monthly,
        price_yearly: p.price_yearly,
        features: Array.isArray(p.features) ? p.features as string[] : [],
        icon: PLAN_ICONS[p.name] || <Zap className="w-5 h-5" />,
        highlight: PLAN_HIGHLIGHTS[p.name] || false,
        badge: PLAN_BADGES[p.name],
      })));
    }
    setLoading(false);
  };

  const validatePromoCode = async (planPrice: number) => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-promo', {
        body: { promoCode: promoCode.trim(), planPrice },
      });
      if (error) throw error;
      setPromoResult(data);
      if (data.valid) {
        toast.success(`Promo code applied! You save ₹${data.discount_amount}`);
      } else {
        toast.error(data.error || 'Invalid promo code');
      }
    } catch {
      toast.error('Failed to validate promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSubscribe = (plan: PlanTier) => {
    if (plan.price_monthly === 0) {
      toast.info('You are on the Free plan by default');
      return;
    }
    setSelectedPlanForPayment(plan);
    setPromoResult(null);
    setPromoCode('');
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    toast.success('🎉 Subscription activated!');
    onSubscribe?.();
  };

  const getPrice = (plan: PlanTier) =>
    billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

  const getSavingsPercent = (plan: PlanTier) => {
    if (plan.price_monthly === 0) return 0;
    return Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Crown className="w-8 h-8 text-primary" />
            <h2 className="text-2xl font-bold">Openflip Plans</h2>
          </div>
          <p className="text-muted-foreground">Choose the plan that fits your journey</p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-full bg-muted p-1">
            <button
              onClick={() => { setBillingCycle('monthly'); setPromoResult(null); }}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                billingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => { setBillingCycle('yearly'); setPromoResult(null); }}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1',
                billingCycle === 'yearly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'
              )}
            >
              Yearly
              <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-500">Save up to 33%</Badge>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="space-y-3">
          {plans.map((plan, index) => {
            const price = getPrice(plan);
            const savings = getSavingsPercent(plan);
            const isCurrentPlan = currentPlan === plan.name.toLowerCase();

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'relative rounded-2xl border-2 p-5 overflow-hidden transition-all',
                  plan.highlight
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : isCurrentPlan
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-card hover:border-primary/30'
                )}
              >
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />

                {plan.badge && (
                  <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground text-xs">
                    {plan.badge}
                  </Badge>
                )}

                {isCurrentPlan && (
                  <Badge className="absolute top-3 right-3 bg-green-500 text-white text-xs">
                    <Check className="w-3 h-3 mr-1" /> Current
                  </Badge>
                )}

                <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Plan Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        {plan.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      </div>
                    </div>

                    {/* Features preview */}
                    <div className="flex flex-wrap gap-1.5">
                      {plan.features.slice(0, 4).map((f, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-secondary rounded-full text-muted-foreground">
                          {f}
                        </span>
                      ))}
                      {plan.features.length > 4 && (
                        <span className="text-xs px-2 py-0.5 bg-secondary rounded-full text-muted-foreground">
                          +{plan.features.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & CTA */}
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <div className="text-right">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-2xl font-bold">₹{price}</span>
                        <span className="text-xs text-muted-foreground">
                          /{billingCycle === 'yearly' ? 'yr' : 'mo'}
                        </span>
                      </div>
                      {billingCycle === 'yearly' && savings > 0 && (
                        <p className="text-xs text-green-500">Save {savings}%</p>
                      )}
                    </div>

                    {!isCurrentPlan && (
                      <Button
                        size="sm"
                        onClick={() => handleSubscribe(plan)}
                        className={cn(
                          plan.highlight
                            ? 'bg-gradient-to-r from-primary to-purple-600 hover:opacity-90'
                            : plan.price_monthly === 0
                            ? 'variant-outline'
                            : ''
                        )}
                        variant={plan.price_monthly === 0 ? 'outline' : 'default'}
                      >
                        {plan.price_monthly === 0 ? 'Current' : 'Subscribe'}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span>🔒 Secure checkout</span>
          <span>💳 UPI, Cards & more</span>
          <span>🌍 Pay in ₹ INR</span>
          <span>❌ Cancel anytime</span>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscribe to {selectedPlanForPayment?.name}</DialogTitle>
          </DialogHeader>
          
          {selectedPlanForPayment && (
            <div className="space-y-4">
              {/* Plan summary */}
              <div className="p-4 rounded-xl bg-secondary/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      {selectedPlanForPayment.icon}
                    </div>
                    <span className="font-semibold">{selectedPlanForPayment.name}</span>
                  </div>
                  <div className="text-right">
                    {promoResult?.valid && (
                      <span className="text-sm text-muted-foreground line-through mr-2">
                        ₹{getPrice(selectedPlanForPayment)}
                      </span>
                    )}
                    <span className="text-xl font-bold">
                      ₹{promoResult?.valid && promoResult.final_price !== undefined
                        ? promoResult.final_price
                        : getPrice(selectedPlanForPayment)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      /{billingCycle === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Promo Code */}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => validatePromoCode(getPrice(selectedPlanForPayment))}
                  disabled={promoLoading || !promoCode.trim()}
                >
                  {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
              {promoResult && !promoResult.valid && (
                <p className="text-xs text-destructive">{promoResult.error}</p>
              )}
              {promoResult?.valid && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> You save ₹{promoResult.discount_amount}
                </p>
              )}

              <PaymentCheckout
                amount={promoResult?.valid && promoResult.final_price !== undefined
                  ? promoResult.final_price
                  : getPrice(selectedPlanForPayment)}
                description={`Openflip ${selectedPlanForPayment.name} - ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}`}
                type="subscription"
                billingCycle={billingCycle}
                promoCode={promoResult?.valid ? promoCode : undefined}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowPayment(false)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
