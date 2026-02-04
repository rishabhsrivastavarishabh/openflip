import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Rocket, Target, Users, Eye, IndianRupee,
  Calendar, Loader2, Play, Image, CheckCircle2, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface BoostCampaignProps {
  onBack: () => void;
  initialContentType?: string;
  initialContentId?: string;
}

interface Campaign {
  id: string;
  content_type: string;
  content_id: string;
  budget: number;
  duration_days: number;
  status: string;
  reach_estimate: number | null;
  actual_reach: number;
  impressions: number;
  clicks: number;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
}

interface ContentOption {
  id: string;
  type: 'post' | 'reel';
  preview_url: string;
  caption: string | null;
}

export function BoostCampaign({ onBack, initialContentType, initialContentId }: BoostCampaignProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contentOptions, setContentOptions] = useState<ContentOption[]>([]);
  const [showCreate, setShowCreate] = useState(!!initialContentId);
  
  const [formData, setFormData] = useState({
    contentId: initialContentId || '',
    budget: 500,
    duration: 7,
    targetAge: 'all',
    targetLocation: 'all',
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch existing campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('boost_campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;
      setCampaigns(campaignsData || []);

      // Fetch user's content for selection
      const { data: posts } = await supabase
        .from('posts')
        .select('id, media_url, caption')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: reels } = await supabase
        .from('reels')
        .select('id, video_url, caption')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const options: ContentOption[] = [
        ...(posts || []).map(p => ({ id: p.id, type: 'post' as const, preview_url: p.media_url, caption: p.caption })),
        ...(reels || []).map(r => ({ id: r.id, type: 'reel' as const, preview_url: r.video_url, caption: r.caption })),
      ];

      setContentOptions(options);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const calculateReachEstimate = () => {
    // Simplified reach estimation based on budget and duration
    const baseReach = formData.budget * 10; // ₹1 = ~10 impressions
    const durationMultiplier = Math.log2(formData.duration + 1);
    return Math.round(baseReach * durationMultiplier);
  };

  const handleCreateCampaign = async () => {
    if (!user || !formData.contentId) {
      toast.error('Please select content to boost');
      return;
    }

    setCreating(true);
    try {
      const selectedContent = contentOptions.find(c => c.id === formData.contentId);
      
      const { error } = await supabase
        .from('boost_campaigns')
        .insert({
          user_id: user.id,
          content_type: selectedContent?.type || 'post',
          content_id: formData.contentId,
          budget: formData.budget,
          currency: 'INR',
          duration_days: formData.duration,
          target_audience: {
            age: formData.targetAge,
            location: formData.targetLocation,
          },
          reach_estimate: calculateReachEstimate(),
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Boost campaign created! Pending payment.');
      setShowCreate(false);
      fetchData();
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'active':
        return <Badge className="bg-green-500"><Rocket className="w-3 h-3 mr-1" /> Active</Badge>;
      case 'completed':
        return <Badge variant="default"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
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
          <h1 className="font-semibold text-lg">Boost & Promote</h1>
        </header>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (showCreate) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Create Boost Campaign</h1>
        </header>

        {/* Content Selection */}
        <div className="space-y-2">
          <Label>Select Content to Boost</Label>
          <Select
            value={formData.contentId}
            onValueChange={(v) => setFormData({ ...formData, contentId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a post or reel" />
            </SelectTrigger>
            <SelectContent>
              {contentOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <div className="flex items-center gap-2">
                    {option.type === 'post' ? (
                      <Image className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span className="truncate max-w-[200px]">
                      {option.caption || `${option.type} - ${option.id.slice(0, 8)}`}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Budget */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Budget</Label>
            <span className="text-lg font-bold text-primary">₹{formData.budget}</span>
          </div>
          <Slider
            value={[formData.budget]}
            onValueChange={(v) => setFormData({ ...formData, budget: v[0] })}
            min={100}
            max={10000}
            step={100}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>₹100</span>
            <span>₹10,000</span>
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Duration</Label>
            <span className="font-medium">{formData.duration} days</span>
          </div>
          <Slider
            value={[formData.duration]}
            onValueChange={(v) => setFormData({ ...formData, duration: v[0] })}
            min={1}
            max={30}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 day</span>
            <span>30 days</span>
          </div>
        </div>

        {/* Target Audience */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Target Age</Label>
            <Select
              value={formData.targetAge}
              onValueChange={(v) => setFormData({ ...formData, targetAge: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ages</SelectItem>
                <SelectItem value="18-24">18-24</SelectItem>
                <SelectItem value="25-34">25-34</SelectItem>
                <SelectItem value="35-44">35-44</SelectItem>
                <SelectItem value="45+">45+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target Location</Label>
            <Select
              value={formData.targetLocation}
              onValueChange={(v) => setFormData({ ...formData, targetLocation: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All India</SelectItem>
                <SelectItem value="metros">Metro Cities</SelectItem>
                <SelectItem value="north">North India</SelectItem>
                <SelectItem value="south">South India</SelectItem>
                <SelectItem value="east">East India</SelectItem>
                <SelectItem value="west">West India</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reach Estimate */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-primary/10 border border-primary/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <span className="font-medium">Estimated Reach</span>
            </div>
            <span className="text-2xl font-bold text-primary">
              {calculateReachEstimate().toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Based on your budget and targeting options
          </p>
        </motion.div>

        {/* Create Button */}
        <Button
          onClick={handleCreateCampaign}
          disabled={creating || !formData.contentId}
          className="w-full"
          size="lg"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Rocket className="w-4 h-4 mr-2" />
          )}
          Create Campaign • ₹{formData.budget}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg flex-1">Boost & Promote</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Rocket className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </header>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20"
      >
        <div className="flex items-start gap-3">
          <Rocket className="w-6 h-6 text-primary flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Boost Your Content</h3>
            <p className="text-sm text-muted-foreground">
              Reach more people and grow your audience by promoting your best posts and reels.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Campaigns List */}
      <div className="space-y-3">
        <h3 className="font-semibold">Your Campaigns</h3>
        
        {campaigns.map((campaign, index) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 rounded-xl bg-secondary/50 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {campaign.content_type === 'post' ? (
                  <Image className="w-5 h-5 text-primary" />
                ) : (
                  <Play className="w-5 h-5 text-primary" />
                )}
                <span className="font-medium capitalize">{campaign.content_type} Boost</span>
              </div>
              {getStatusBadge(campaign.status)}
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Budget</p>
                <p className="font-medium">₹{campaign.budget}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">{campaign.duration_days} days</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reach</p>
                <p className="font-medium">
                  {campaign.actual_reach > 0 
                    ? campaign.actual_reach.toLocaleString()
                    : `~${(campaign.reach_estimate || 0).toLocaleString()}`
                  }
                </p>
              </div>
            </div>

            {campaign.status === 'active' && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t text-sm">
                <div>
                  <p className="text-muted-foreground">Impressions</p>
                  <p className="font-medium">{campaign.impressions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Clicks</p>
                  <p className="font-medium">{campaign.clicks.toLocaleString()}</p>
                </div>
              </div>
            )}
          </motion.div>
        ))}

        {campaigns.length === 0 && (
          <div className="text-center py-12">
            <Rocket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No campaigns yet</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowCreate(true)}
            >
              Create your first campaign
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
