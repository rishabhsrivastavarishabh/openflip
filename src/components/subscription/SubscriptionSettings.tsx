import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  ArrowLeft, Crown, CreditCard, Calendar, RefreshCw, Download,
  AlertCircle, CheckCircle2, Loader2, History, ArrowUp, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SubscriptionPlans } from './SubscriptionPlans';
import { PaymentCheckout } from '@/components/payment/PaymentCheckout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface SubscriptionSettingsProps {
  onBack: () => void;
}

interface SubscriptionStatus {
  subscribed: boolean;
  subscription_end?: string;
  billing_cycle?: string;
  cancel_at_period_end?: boolean;
}

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
}

export function SubscriptionSettings({ onBack }: SubscriptionSettingsProps) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPaymentHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setPaymentHistory((data || []) as PaymentRecord[]);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    checkSubscription();
    fetchPaymentHistory();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    checkSubscription();
    fetchPaymentHistory();
  };

  const downloadInvoice = (payment: PaymentRecord) => {
    const invoiceNumber = `INV-${payment.id.slice(0, 8).toUpperCase()}`;
    const date = format(new Date(payment.created_at), 'dd MMM yyyy');
    const txnId = payment.stripe_payment_intent_id || payment.id.slice(0, 12);
    const gstRate = 18;
    const baseAmount = Math.round(payment.amount / (1 + gstRate / 100) * 100) / 100;
    const gstAmount = Math.round((payment.amount - baseAmount) * 100) / 100;

    const invoiceContent = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                   OPENFLIP
              Tax Invoice / Receipt
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Invoice No:      ${invoiceNumber}
Transaction ID:  ${txnId}
Date:            ${date}
Status:          ${payment.status.toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESCRIPTION                           AMOUNT (₹)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${(payment.description || 'Subscription').padEnd(38)} ${baseAmount.toFixed(2)}
GST (${gstRate}%)                                ${gstAmount.toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL                                  ₹${payment.amount.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Payment Method: Razorpay (UPI/Cards/NetBanking)
Currency: INR (₹)

Thank you for subscribing to Openflip!
For queries: support@openflip.app
    `.trim();

    const blob = new Blob([invoiceContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openflip-invoice-${invoiceNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Invoice downloaded');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Plans & Subscription</h1>
        </header>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading subscription..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">Plans & Subscription</h1>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {/* Current Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl border ${
          subscription?.subscribed ? 'border-primary bg-primary/5' : 'border-border bg-muted/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            subscription?.subscribed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {subscription?.subscribed ? <CheckCircle2 className="w-6 h-6" /> : <Crown className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {subscription?.subscribed ? 'Active Subscription' : 'No Active Plan'}
              </span>
              {subscription?.subscribed && (
                <Badge variant="default" className="text-xs capitalize">
                  {subscription.billing_cycle}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {subscription?.subscribed
                ? `Active until ${format(new Date(subscription.subscription_end!), 'MMM d, yyyy')}`
                : 'Choose a plan to unlock premium features'
              }
            </p>
          </div>
        </div>

        {subscription?.subscribed && subscription?.cancel_at_period_end && (
          <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Will end on {format(new Date(subscription.subscription_end!), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        )}
      </motion.div>

      <Separator />

      {/* Subscription Plans */}
      <SubscriptionPlans
        currentPlan={subscription?.subscribed ? subscription.billing_cycle : null}
        onSubscribe={handleRefresh}
      />

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <>
          <Separator />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <History className="w-4 h-4" />
              Payment History
            </h3>
            <div className="space-y-2">
              {paymentHistory.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                  <div>
                    <p className="font-medium text-sm">{payment.description || 'Payment'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.created_at), 'MMM d, yyyy')} · ID: {payment.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium">₹{payment.amount.toFixed(2)}</p>
                      <Badge
                        variant={payment.status === 'completed' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {payment.status}
                      </Badge>
                    </div>
                    {payment.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadInvoice(payment)}
                        title="Download Invoice"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
