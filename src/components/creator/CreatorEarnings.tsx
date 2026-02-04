import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  ArrowLeft, DollarSign, TrendingUp, Wallet, Clock,
  CreditCard, CheckCircle2, XCircle, Loader2, IndianRupee
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreatorEarningsProps {
  onBack: () => void;
}

interface EarningsStats {
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  adEarnings: number;
  promotionEarnings: number;
  subscriptionEarnings: number;
}

interface Earning {
  id: string;
  earning_type: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  created_at: string;
}

interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  processed_at: string | null;
}

export function CreatorEarnings({ onBack }: CreatorEarningsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EarningsStats>({
    totalEarnings: 0,
    pendingEarnings: 0,
    paidEarnings: 0,
    adEarnings: 0,
    promotionEarnings: 0,
    subscriptionEarnings: 0,
  });
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEarnings();
    }
  }, [user]);

  const fetchEarnings = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch earnings
      const { data: earningsData, error: earningsError } = await supabase
        .from('creator_earnings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (earningsError) throw earningsError;
      setEarnings(earningsData || []);

      // Calculate stats
      const allEarnings = earningsData || [];
      const totalEarnings = allEarnings.reduce((sum, e) => sum + Number(e.amount), 0);
      const pendingEarnings = allEarnings
        .filter(e => e.status === 'pending' || e.status === 'approved')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const paidEarnings = allEarnings
        .filter(e => e.status === 'paid')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const adEarnings = allEarnings
        .filter(e => e.earning_type === 'ad')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const promotionEarnings = allEarnings
        .filter(e => e.earning_type === 'promotion')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const subscriptionEarnings = allEarnings
        .filter(e => e.earning_type === 'subscription')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      setStats({
        totalEarnings,
        pendingEarnings,
        paidEarnings,
        adEarnings,
        promotionEarnings,
        subscriptionEarnings,
      });

      // Fetch payout requests
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (payoutsError) throw payoutsError;
      setPayouts(payoutsData || []);
    } catch (error) {
      console.error('Error fetching earnings:', error);
      toast.error('Failed to load earnings');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!user || !payoutAmount) return;
    
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > stats.pendingEarnings) {
      toast.error('Amount exceeds available balance');
      return;
    }

    setPayoutLoading(true);
    try {
      const { error } = await supabase
        .from('payout_requests')
        .insert({
          user_id: user.id,
          amount,
          currency: 'INR',
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Payout request submitted!');
      setShowPayoutDialog(false);
      setPayoutAmount('');
      fetchEarnings();
    } catch (error) {
      console.error('Error requesting payout:', error);
      toast.error('Failed to submit payout request');
    } finally {
      setPayoutLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'approved':
        return <Badge variant="default"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'paid':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      case 'processing':
        return <Badge variant="default"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Earnings</h1>
        </header>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
        <h1 className="font-semibold text-lg">Earnings</h1>
      </header>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground"
      >
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-5 h-5" />
          <span className="text-sm opacity-90">Available Balance</span>
        </div>
        <div className="flex items-baseline gap-1 mb-4">
          <IndianRupee className="w-6 h-6" />
          <span className="text-4xl font-bold">{stats.pendingEarnings.toLocaleString()}</span>
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setShowPayoutDialog(true)}
          disabled={stats.pendingEarnings <= 0}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Request Payout
        </Button>
      </motion.div>

      {/* Earnings Breakdown */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-secondary/50 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
          <p className="text-lg font-bold">₹{stats.totalEarnings.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Earned</p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
          <p className="text-lg font-bold">₹{stats.pendingEarnings.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <p className="text-lg font-bold">₹{stats.paidEarnings.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Paid Out</p>
        </div>
      </div>

      {/* Earnings by Type */}
      <div className="p-4 rounded-xl bg-secondary/50 space-y-3">
        <h3 className="font-semibold">Earnings by Type</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ad Revenue</span>
            <span className="font-medium">₹{stats.adEarnings.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Promotions</span>
            <span className="font-medium">₹{stats.promotionEarnings.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subscriptions</span>
            <span className="font-medium">₹{stats.subscriptionEarnings.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Recent Earnings */}
      {earnings.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Recent Earnings</h3>
          {earnings.slice(0, 5).map((earning) => (
            <div
              key={earning.id}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/50"
            >
              <div>
                <p className="font-medium capitalize">{earning.earning_type} Revenue</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(earning.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-500">+₹{Number(earning.amount).toLocaleString()}</p>
                {getStatusBadge(earning.status)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payout Requests */}
      {payouts.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Payout Requests</h3>
          {payouts.slice(0, 5).map((payout) => (
            <div
              key={payout.id}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/50"
            >
              <div>
                <p className="font-medium">Payout Request</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(payout.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold">₹{Number(payout.amount).toLocaleString()}</p>
                {getStatusBadge(payout.status)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {earnings.length === 0 && (
        <div className="text-center py-8">
          <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No earnings yet</p>
          <p className="text-sm text-muted-foreground">
            Start creating content to earn!
          </p>
        </div>
      )}

      {/* Payout Dialog */}
      <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Enter the amount you'd like to withdraw. Minimum payout is ₹100.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                min={100}
                max={stats.pendingEarnings}
              />
              <p className="text-xs text-muted-foreground">
                Available: ₹{stats.pendingEarnings.toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayoutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestPayout} disabled={payoutLoading}>
              {payoutLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Request Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
