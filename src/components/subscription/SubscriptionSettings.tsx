import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  ArrowLeft, Crown, CreditCard, Calendar, RefreshCw, 
  ExternalLink, AlertCircle, CheckCircle2, XCircle, Loader2, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertDialog, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { SubscriptionPlans, SUBSCRIPTION_PLANS } from './SubscriptionPlans';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SubscriptionSettingsProps {
  onBack: () => void;
}

interface SubscriptionStatus {
  subscribed: boolean;
  product_id?: string;
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
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
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
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error(error.message || 'Failed to open subscription management');
    } finally {
      setPortalLoading(false);
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
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
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
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Manage Billing & Payment
              <ExternalLink className="w-3 h-3 ml-auto" />
            </Button>

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
                <div 
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-secondary/50"
                >
                  <div>
                    <p className="font-medium text-sm">{payment.description || 'Subscription payment'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      ₹{(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                    </p>
                    <Badge 
                      variant={payment.status === 'succeeded' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {payment.status}
                    </Badge>
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
