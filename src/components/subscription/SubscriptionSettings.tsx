import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  ArrowLeft, Crown, CreditCard, Calendar, RefreshCw, Download,
  AlertCircle, CheckCircle2, Loader2, History, ArrowUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SubscriptionPlans, SUBSCRIPTION_PLANS } from './SubscriptionPlans';
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
  billing_cycle?: 'monthly' | 'yearly';
  cancel_at_period_end?: boolean;
}

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created_at: string;
}

export function SubscriptionSettings({ onBack }: SubscriptionSettingsProps) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

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
        .limit(10);
      
      if (error) throw error;
      setPaymentHistory(data || []);
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

  const handleUpgradeSuccess = () => {
    setShowUpgrade(false);
    toast.success('🎉 Upgraded to yearly plan!');
    handleRefresh();
  };

  const downloadInvoice = async (payment: PaymentRecord) => {
    try {
      const invoiceData = {
        invoiceNumber: `INV-${payment.id.slice(0, 8).toUpperCase()}`,
        date: format(new Date(payment.created_at), 'dd MMM yyyy'),
        amount: payment.amount,
        currency: payment.currency?.toUpperCase() || 'INR',
        description: payment.description || 'Openflip Verified Subscription',
        status: payment.status,
      };
      
      const invoiceContent = `
OPENFLIP INVOICE
================

Invoice Number: ${invoiceData.invoiceNumber}
Date: ${invoiceData.date}

Description: ${invoiceData.description}
Amount: ₹${invoiceData.amount.toFixed(2)} ${invoiceData.currency}
Status: ${invoiceData.status.toUpperCase()}

Thank you for subscribing to Openflip Verified!

For any queries, contact support@openflip.app
      `.trim();
      
      const blob = new Blob([invoiceContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openflip-invoice-${invoiceData.invoiceNumber}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Invoice downloaded');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice');
    }
  };

  const getCurrentPlan = (): 'monthly' | 'yearly' | null => {
    if (!subscription?.subscribed) return null;
    return subscription.billing_cycle || null;
  };

  const currentPlan = getCurrentPlan();

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Verification & Subscription</h1>
        </header>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading subscription..." />
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">Verification & Subscription</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          className="ml-auto"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {/* Current Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 rounded-xl border ${
          subscription?.subscribed 
            ? 'border-primary bg-primary/5' 
            : 'border-border bg-muted/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            subscription?.subscribed 
              ? 'bg-primary/10 text-primary' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {subscription?.subscribed ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : (
              <Crown className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {subscription?.subscribed ? 'Verified' : 'Not Verified'}
              </span>
              {subscription?.subscribed && (
                <Badge variant="default" className="text-xs">
                  {currentPlan === 'yearly' ? 'Yearly' : 'Monthly'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {subscription?.subscribed 
                ? `Your badge is active until ${format(new Date(subscription.subscription_end!), 'MMM d, yyyy')}`
                : 'Subscribe for ₹99/month to get verified and unlock premium features'
              }
            </p>
          </div>
        </div>

        {subscription?.subscribed && subscription?.cancel_at_period_end && (
          <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Your subscription will end on {format(new Date(subscription.subscription_end!), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Subscription Management */}
      {subscription?.subscribed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Manage Subscription
          </h3>
          
          <div className="space-y-2">
            {/* Upgrade Option */}
            {currentPlan === 'monthly' && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 border-primary text-primary hover:bg-primary/10"
                onClick={() => setShowUpgrade(true)}
              >
                <ArrowUp className="w-4 h-4" />
                Upgrade to Yearly (Save 33%)
              </Button>
            )}

            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Next billing date</p>
                  <p className="font-medium">
                    {subscription.cancel_at_period_end 
                      ? 'No renewal' 
                      : format(new Date(subscription.subscription_end!), 'MMMM d, yyyy')
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <Separator />

      {/* Plans */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {!subscription?.subscribed ? (
          <SubscriptionPlans currentPlan={currentPlan} onSubscribe={handleRefresh} />
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Your Plan Benefits
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '✓', label: 'Verified Badge' },
                { icon: '🔍', label: 'Priority Search' },
                { icon: '📊', label: 'Analytics' },
                { icon: '⚡', label: 'Priority Support' },
              ].map((benefit, i) => (
                <div 
                  key={i}
                  className="p-3 rounded-xl bg-secondary/50 flex items-center gap-2"
                >
                  <span className="text-lg">{benefit.icon}</span>
                  <span className="text-sm font-medium">{benefit.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

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
                    <p className="font-medium text-sm">{payment.description || 'Subscription payment'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium">
                        ₹{payment.amount.toFixed(2)}
                      </p>
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

    {/* Upgrade Dialog */}
    <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade to Yearly Plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold">Current Plan</p>
                <p className="text-2xl font-bold">₹99/month</p>
              </div>
              <ArrowUp className="w-8 h-8 text-primary" />
              <div className="text-right">
                <p className="font-semibold">Yearly Plan</p>
                <p className="text-2xl font-bold text-primary">₹799/year</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10 dark:text-green-400 text-green-600 text-sm text-center">
              💰 Save ₹{(99 * 12) - 799} per year (33% off)
            </div>
          </div>
          
          <PaymentCheckout
            amount={799 - 99} // Prorated amount (difference)
            description="Upgrade to Yearly Plan (Prorated)"
            type="subscription"
            billingCycle="yearly"
            onSuccess={handleUpgradeSuccess}
            onCancel={() => setShowUpgrade(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
