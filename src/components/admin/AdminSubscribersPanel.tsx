import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Crown, Users, DollarSign, TrendingUp, Search, 
  CheckCircle2, XCircle, MoreVertical, RefreshCw, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Subscriber {
  id: string;
  user_id: string;
  billing_cycle: string;
  status: string;
  current_period_end: string;
  created_at: string;
  profile: {
    username: string;
    avatar_url: string | null;
    full_name: string | null;
  } | null;
}

interface RevenueStats {
  totalRevenue: number;
  monthlySubscribers: number;
  yearlySubscribers: number;
  activeSubscribers: number;
}

export function AdminSubscribersPanel() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    monthlySubscribers: 0,
    yearlySubscribers: 0,
    activeSubscribers: 0,
  });
  const [selectedUser, setSelectedUser] = useState<Subscriber | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      // Fetch all subscriptions with profile data
      const { data: subscriptions, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for subscribers
      if (subscriptions && subscriptions.length > 0) {
        const userIds = subscriptions.map(s => s.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, full_name')
          .in('id', userIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const subscribersData = subscriptions.map(s => ({
          ...s,
          profile: profilesMap.get(s.user_id) || null,
        }));

        setSubscribers(subscribersData);

        // Calculate stats
        const active = subscribersData.filter(s => s.status === 'active');
        const monthly = active.filter(s => s.billing_cycle === 'monthly').length;
        const yearly = active.filter(s => s.billing_cycle === 'yearly').length;
        
        // Estimate revenue (monthly * $9.99 + yearly * $79.99/12 per month)
        const estimatedMonthlyRevenue = (monthly * 9.99) + (yearly * (79.99 / 12));

        setStats({
          totalRevenue: estimatedMonthlyRevenue,
          monthlySubscribers: monthly,
          yearlySubscribers: yearly,
          activeSubscribers: active.length,
        });
      }
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      toast.error('Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const handleGrantVerification = async (userId: string) => {
    setActionLoading(true);
    try {
      await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', userId);
      
      toast.success('Verification granted');
      fetchSubscribers();
    } catch (error) {
      toast.error('Failed to grant verification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeVerification = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await supabase
        .from('profiles')
        .update({ is_verified: false })
        .eq('id', selectedUser.user_id);
      
      toast.success('Verification revoked');
      setShowRevokeDialog(false);
      setSelectedUser(null);
      fetchSubscribers();
    } catch (error) {
      toast.error('Failed to revoke verification');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSubscribers = subscribers.filter(s => 
    s.profile?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeSubscribers = filteredSubscribers.filter(s => s.status === 'active');
  const inactiveSubscribers = filteredSubscribers.filter(s => s.status !== 'active');

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Active</span>
          </div>
          <p className="text-2xl font-bold">{stats.activeSubscribers}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Est. MRR</span>
          </div>
          <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(0)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-secondary/50 border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Monthly</span>
          </div>
          <p className="text-2xl font-bold">{stats.monthlySubscribers}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-secondary/50 border"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Yearly</span>
          </div>
          <p className="text-2xl font-bold">{stats.yearlySubscribers}</p>
        </motion.div>
      </div>

      {/* Search & Refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subscribers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={fetchSubscribers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Subscribers Tabs */}
      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Active ({activeSubscribers.length})
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive ({inactiveSubscribers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-2 mt-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))
          ) : activeSubscribers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Crown className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No active subscribers</p>
            </div>
          ) : (
            activeSubscribers.map((subscriber) => (
              <SubscriberRow
                key={subscriber.id}
                subscriber={subscriber}
                onRevoke={() => {
                  setSelectedUser(subscriber);
                  setShowRevokeDialog(true);
                }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="inactive" className="space-y-2 mt-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))
          ) : inactiveSubscribers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <XCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No inactive subscribers</p>
            </div>
          ) : (
            inactiveSubscribers.map((subscriber) => (
              <SubscriberRow
                key={subscriber.id}
                subscriber={subscriber}
                onGrant={() => handleGrantVerification(subscriber.user_id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Revoke Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Verification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke verification for @{selectedUser?.profile?.username}? 
              This will remove their verified badge immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevokeVerification}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SubscriberRowProps {
  subscriber: Subscriber;
  onRevoke?: () => void;
  onGrant?: () => void;
}

function SubscriberRow({ subscriber, onRevoke, onGrant }: SubscriberRowProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary/70 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={subscriber.profile?.avatar_url || undefined} />
          <AvatarFallback>
            {subscriber.profile?.username?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{subscriber.profile?.username || 'Unknown'}</span>
            {subscriber.status === 'active' && (
              <CheckCircle2 className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {subscriber.billing_cycle}
            </Badge>
            {subscriber.current_period_end && (
              <span>
                Expires {format(new Date(subscriber.current_period_end), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {subscriber.status === 'active' && onRevoke && (
            <DropdownMenuItem onClick={onRevoke} className="text-destructive">
              <XCircle className="w-4 h-4 mr-2" />
              Revoke Verification
            </DropdownMenuItem>
          )}
          {subscriber.status !== 'active' && onGrant && (
            <DropdownMenuItem onClick={onGrant}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Grant Verification
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
