import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CreditCard, Building2, Smartphone,
  Check, AlertCircle, Loader2, QrCode, Tag, X, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentCheckoutProps {
  amount: number;
  description: string;
  type: 'subscription' | 'boost' | 'tip' | 'creator_subscription';
  metadata?: Record<string, string>;
  billingCycle?: string;
  promoCode?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PaymentCheckout({
  amount,
  description,
  type,
  metadata,
  billingCycle,
  promoCode: initialPromoCode,
  onSuccess,
  onCancel,
}: PaymentCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState(initialPromoCode || '');
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount_amount?: number;
    final_price?: number;
    error?: string;
  } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const displayAmount = promoResult?.valid && promoResult.final_price !== undefined
    ? promoResult.final_price
    : amount;

  const gst = Math.round(displayAmount * 0.18);
  const totalAmount = displayAmount + gst;

  const validatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-promo', {
        body: { promoCode: promoCode.trim(), planPrice: amount },
      });
      if (error) throw error;
      setPromoResult(data);
      if (data.valid) {
        toast.success(`Promo applied! You save ₹${data.discount_amount}`);
      } else {
        toast.error(data.error || 'Invalid promo code');
      }
    } catch (error) {
      toast.error('Failed to validate promo');
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      toast.error('Payment gateway is loading. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // Create Razorpay order
      const { data: orderData, error: orderError } = await supabase.functions.invoke('razorpay-create-order', {
        body: {
          amount: displayAmount,
          type,
          billingCycle,
          promoCode: promoResult?.valid ? promoCode.trim() : undefined,
          metadata,
        },
      });

      if (orderError) throw orderError;
      if (!orderData?.order_id) throw new Error('Failed to create order');

      // Open Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Openflip',
        description: description,
        order_id: orderData.order_id,
        prefill: orderData.prefill,
        notes: orderData.notes,
        theme: {
          color: '#7C3AED', // Primary purple color
        },
        handler: async (response: any) => {
          // Verify payment
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('razorpay-verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                type,
                billing_cycle: billingCycle,
                promo_code: promoResult?.valid ? promoCode.trim() : undefined,
                metadata,
              },
            });

            if (verifyError) throw verifyError;
            if (verifyData?.success) {
              setPaymentSuccess(true);
              toast.success('Payment successful!');
              setTimeout(() => {
                onSuccess?.();
              }, 1500);
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error: any) {
            toast.error(error.message || 'Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (response: any) => {
        toast.error(response.error.description || 'Payment failed');
        setLoading(false);
      });
      razorpay.open();
    } catch (error: any) {
      toast.error(error.message || 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  if (paymentSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12 space-y-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center"
        >
          <Check className="w-10 h-10 text-green-500" />
        </motion.div>
        <h2 className="text-xl font-semibold">Payment Successful!</h2>
        <p className="text-muted-foreground text-center">
          Your payment has been processed successfully.
        </p>
        <Button onClick={onSuccess} className="mt-4">
          Continue
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h2 className="font-semibold text-lg">Secure Checkout</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {onCancel && (
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Amount Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20"
      >
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>₹{displayAmount}</span>
          </div>
          {promoResult?.valid && (
            <div className="flex justify-between text-sm text-green-500">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Discount
              </span>
              <span>-₹{promoResult.discount_amount}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST (18%)</span>
            <span>₹{gst}</span>
          </div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">₹{totalAmount}</span>
          </div>
        </div>
      </motion.div>

      {/* Promo Code */}
      <div className="space-y-2">
        <Label>Promo Code</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Enter code"
            value={promoCode}
            onChange={(e) => {
              setPromoCode(e.target.value.toUpperCase());
              setPromoResult(null);
            }}
          />
          <Button
            variant="outline"
            onClick={validatePromo}
            disabled={promoLoading || !promoCode.trim()}
          >
            {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
          </Button>
        </div>
        {promoResult && !promoResult.valid && (
          <p className="text-xs text-destructive">{promoResult.error}</p>
        )}
      </div>

      {/* Payment Methods Info */}
      <div className="p-4 rounded-xl bg-secondary/50 space-y-3">
        <p className="text-sm font-medium text-center">Available Payment Methods</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-background">
            <Smartphone className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs">UPI</span>
          </div>
          <div className="p-2 rounded-lg bg-background">
            <CreditCard className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs">Cards</span>
          </div>
          <div className="p-2 rounded-lg bg-background">
            <Building2 className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs">NetBank</span>
          </div>
          <div className="p-2 rounded-lg bg-background">
            <Wallet className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs">Wallets</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Google Pay • PhonePe • Paytm • Credit/Debit Cards • Net Banking
        </p>
      </div>

      {/* Pay Button */}
      <Button
        onClick={handlePayment}
        disabled={loading || !razorpayLoaded}
        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
        size="lg"
      >
        {loading ? (
          <LoadingSpinner size="sm" />
        ) : !razorpayLoaded ? (
          'Loading...'
        ) : (
          <>Pay ₹{totalAmount}</>
        )}
      </Button>

      {/* Security */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>🔒 256-bit SSL Encryption</span>
        <span>•</span>
        <span>PCI DSS Compliant</span>
      </div>

      {/* Razorpay branding */}
      <p className="text-xs text-muted-foreground text-center">
        Powered by Razorpay
      </p>
    </div>
  );
}
