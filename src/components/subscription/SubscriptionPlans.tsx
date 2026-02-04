import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Sparkles, Star, Zap, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// INR Stripe price IDs
export const SUBSCRIPTION_PLANS = {
  monthly: {
    priceId: 'price_1SwxVBQUKes0XsxYJ9N882wn',
    productId: 'prod_Tun5w14Dic9AQf',
    price: 99,
    period: 'month',
    label: 'Monthly',
    currency: '₹',
  },
  yearly: {
    priceId: 'price_1SwxVnQUKes0XsxYWJbL5R01',
    productId: 'prod_Tun5ROkSxQZKRK',
    price: 799,
    period: 'year',
    label: 'Yearly',
    savings: '33%',
    currency: '₹',
  },
};

const FEATURES = [
  'Verified badge (✓) on your profile',
  'Priority in search results',
  'Higher visibility in feed & reels',
  'Access to creator tools',
  'Business analytics dashboard',
  'Priority customer support',
];

interface SubscriptionPlansProps {
  currentPlan?: 'monthly' | 'yearly' | null;
  onSubscribe?: () => void;
}

export function SubscriptionPlans({ currentPlan, onSubscribe }: SubscriptionPlansProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [loading, setLoading] = useState(false);
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

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    
    setPromoLoading(true);
    setPromoResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-promo', {
        body: {
          promoCode: promoCode.trim(),
          planPrice: SUBSCRIPTION_PLANS[selectedPlan].price,
        },
      });

      if (error) throw error;
      
      setPromoResult(data);
      
      if (data.valid) {
        toast.success(`Promo code applied! You save ₹${data.discount_amount}`);
      } else {
        toast.error(data.error || 'Invalid promo code');
      }
    } catch (error: any) {
      console.error('Promo validation error:', error);
      toast.error('Failed to validate promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: SUBSCRIPTION_PLANS[plan].priceId,
          billingCycle: plan,
          promoCode: promoResult?.valid ? promoCode.trim() : undefined,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        onSubscribe?.();
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const displayPrice = promoResult?.valid && promoResult.final_price !== undefined 
    ? promoResult.final_price 
    : SUBSCRIPTION_PLANS[selectedPlan].price;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Crown className="w-8 h-8 text-primary" />
          <h2 className="text-2xl font-bold">Openflip Verified</h2>
        </div>
        <p className="text-muted-foreground">
          Get verified and unlock premium features
        </p>
      </div>

      {/* Plan Selector */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-full bg-muted p-1">
          <button
            onClick={() => {
              setSelectedPlan('monthly');
              setPromoResult(null);
            }}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors',
              selectedPlan === 'monthly'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted-foreground/10'
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => {
              setSelectedPlan('yearly');
              setPromoResult(null);
            }}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1',
              selectedPlan === 'yearly'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted-foreground/10'
            )}
          >
            Yearly
            <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-500">
              Save 33%
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing Card */}
      <motion.div
        key={selectedPlan}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative rounded-2xl border-2 p-6 overflow-hidden',
          currentPlan === selectedPlan
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card'
        )}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />

        {currentPlan === selectedPlan && (
          <Badge className="absolute top-4 right-4 bg-primary">
            <Star className="w-3 h-3 mr-1" />
            Your Plan
          </Badge>
        )}

        <div className="relative space-y-6">
          {/* Price */}
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1">
              {promoResult?.valid && (
                <span className="text-xl text-muted-foreground line-through mr-2">
                  ₹{SUBSCRIPTION_PLANS[selectedPlan].price}
                </span>
              )}
              <span className="text-4xl font-bold">
                ₹{displayPrice}
              </span>
              <span className="text-muted-foreground">
                /{SUBSCRIPTION_PLANS[selectedPlan].period}
              </span>
            </div>
            {selectedPlan === 'yearly' && !promoResult?.valid && (
              <p className="text-sm text-green-500 mt-1">
                Save ₹{(99 * 12 - 799)} per year
              </p>
            )}
            {promoResult?.valid && (
              <p className="text-sm text-green-500 mt-1 flex items-center justify-center gap-1">
                <Tag className="w-3 h-3" />
                You save ₹{promoResult.discount_amount}
              </p>
            )}
          </div>

          {/* Promo Code Input */}
          {currentPlan !== selectedPlan && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoResult(null);
                  }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={validatePromoCode}
                  disabled={promoLoading || !promoCode.trim()}
                >
                  {promoLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </Button>
              </div>
              {promoResult && !promoResult.valid && (
                <p className="text-xs text-destructive">{promoResult.error}</p>
              )}
            </div>
          )}

          {/* Features */}
          <div className="space-y-3">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3"
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span className="text-sm">{feature}</span>
              </motion.div>
            ))}
          </div>

          {/* CTA Button */}
          {currentPlan !== selectedPlan && (
            <Button
              onClick={() => handleSubscribe(selectedPlan)}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              size="lg"
            >
              {loading ? (
                'Processing...'
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Verified Now
                </>
              )}
            </Button>
          )}

          {currentPlan === selectedPlan && (
            <div className="text-center text-sm text-muted-foreground">
              <Zap className="w-4 h-4 inline mr-1" />
              You're on this plan
            </div>
          )}
        </div>
      </motion.div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span>🔒 Secure checkout</span>
        <span>💳 UPI, Cards & more</span>
        <span>🌍 Pay in ₹ INR</span>
        <span>❌ Cancel anytime</span>
      </div>

      {/* Payment methods */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-2">Accepted payment methods</p>
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="px-2 py-1 bg-muted rounded">💳 Cards</span>
          <span className="px-2 py-1 bg-muted rounded">📱 UPI</span>
          <span className="px-2 py-1 bg-muted rounded">🏦 Net Banking</span>
        </div>
      </div>
    </div>
  );
}
