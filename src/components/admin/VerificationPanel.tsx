import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Check, X, Clock, Users, Building2, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface VerificationRequest {
  id: string;
  user_id: string;
  category: string;
  business_name: string | null;
  business_email: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  request_id: string | null;
  reviewed_at: string | null;
  profile?: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
}

interface VerificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VerificationPanel({ open, onOpenChange }: VerificationPanelProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && user) {
      checkAdminStatus();
      fetchRequests();
    }
  }, [open, user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    setIsAdmin(!!data);
  };

  const fetchRequests = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching verification requests:', error);
      setLoading(false);
      return;
    }

    // Fetch profiles for each request
    if (data && data.length > 0) {
      const userIds = data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio')
        .in('id', userIds);

      const requestsWithProfiles = data.map(request => ({
        ...request,
        profile: profiles?.find(p => p.id === request.user_id),
      }));

      setRequests(requestsWithProfiles);
    } else {
      setRequests([]);
    }
    
    setLoading(false);
  };

  const handleApprove = async (request: VerificationRequest) => {
    if (!user || processing) return;
    setProcessing(request.id);

    try {
      // Update verification request
      await supabase
        .from('verification_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          notes: reviewNotes[request.id] || null,
        })
        .eq('id', request.id);

      // Update user profile
      await supabase
        .from('profiles')
        .update({
          is_verified: true,
          verification_status: 'verified',
        })
        .eq('id', request.user_id);

      // Create notification
      await supabase.from('notifications').insert({
        user_id: request.user_id,
        actor_id: user.id,
        type: 'follow_accepted', // Using existing type for "verification approved"
      });

      toast.success(`Approved verification for @${request.profile?.username}`);
      fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve verification');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: VerificationRequest) => {
    if (!user || processing) return;
    setProcessing(request.id);

    try {
      await supabase
        .from('verification_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          notes: reviewNotes[request.id] || null,
        })
        .eq('id', request.id);

      await supabase
        .from('profiles')
        .update({
          verification_status: 'rejected',
        })
        .eq('id', request.user_id);

      toast.success(`Rejected verification for @${request.profile?.username}`);
      fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject verification');
    } finally {
      setProcessing(null);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'approved') return r.status === 'approved';
    if (activeTab === 'rejected') return r.status === 'rejected';
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'creator':
        return <User className="w-4 h-4" />;
      case 'brand':
      case 'business':
        return <Building2 className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  if (!isAdmin) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You don't have permission to access this panel.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Verification Requests
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="pending" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Pending
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {requests.filter(r => r.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-1">
              <Check className="w-3 h-3" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-1">
              <X className="w-3 h-3" />
              Rejected
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No {activeTab} verification requests
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredRequests.map(request => (
                  <motion.div
                    key={request.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="border rounded-xl p-4 space-y-4"
                  >
                    {/* User Info */}
                    <div className="flex items-start gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={request.profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {request.profile?.username?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{request.profile?.username}</span>
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            {getCategoryIcon(request.category)}
                            {request.category}
                          </Badge>
                          {request.request_id && (
                            <Badge variant="secondary" className="text-xs font-mono">
                              {request.request_id}
                            </Badge>
                          )}
                          {request.status === 'approved' && (
                            <Badge className="text-xs bg-green-500/20 text-green-500 border-green-500/30">
                              <Check className="w-3 h-3 mr-1" />
                              Approved
                            </Badge>
                          )}
                          {request.status === 'rejected' && (
                            <Badge variant="destructive" className="text-xs">
                              <X className="w-3 h-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                        </div>
                        {request.profile?.full_name && (
                          <p className="text-sm text-muted-foreground">{request.profile.full_name}</p>
                        )}
                        {request.profile?.bio && (
                          <p className="text-sm mt-1 line-clamp-2">{request.profile.bio}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>{new Date(request.created_at).toLocaleDateString()}</p>
                        {request.reviewed_at && (
                          <p className="text-green-500">
                            Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Business Details */}
                    {(request.business_name || request.business_email) && (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                        {request.business_name && (
                          <p><span className="text-muted-foreground">Business:</span> {request.business_name}</p>
                        )}
                        {request.business_email && (
                          <p><span className="text-muted-foreground">Email:</span> {request.business_email}</p>
                        )}
                      </div>
                    )}

                    {/* Review Notes */}
                    {activeTab === 'pending' && (
                      <Textarea
                        placeholder="Add review notes (optional)..."
                        value={reviewNotes[request.id] || ''}
                        onChange={(e) => setReviewNotes(prev => ({ ...prev, [request.id]: e.target.value }))}
                        className="min-h-[60px]"
                      />
                    )}

                    {request.notes && activeTab !== 'pending' && (
                      <p className="text-sm text-muted-foreground italic">
                        Review notes: {request.notes}
                      </p>
                    )}

                    {/* Actions */}
                    {activeTab === 'pending' && (
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleApprove(request)}
                          disabled={processing === request.id}
                        >
                          {processing === request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleReject(request)}
                          disabled={processing === request.id}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}