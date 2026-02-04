import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  ArrowLeft, BarChart3, TrendingUp, Users, Eye, Heart, MessageCircle,
  Share2, Bookmark, UserPlus, ChevronRight, Loader2, Play, Image, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CreatorDashboardProps {
  onBack: () => void;
  onOpenSection?: (section: string) => void;
}

interface DashboardStats {
  totalFollowers: number;
  followerGrowth: number;
  totalReach: number;
  engagementRate: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  postsCount: number;
  reelsCount: number;
  storiesCount: number;
}

export function CreatorDashboard({ onBack, onOpenSection }: CreatorDashboardProps) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [stats, setStats] = useState<DashboardStats>({
    totalFollowers: 0,
    followerGrowth: 0,
    totalReach: 0,
    engagementRate: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalSaves: 0,
    postsCount: 0,
    reelsCount: 0,
    storiesCount: 0,
  });

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user, timeRange]);

  const fetchDashboardStats = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = startOfDay(subDays(new Date(), daysAgo)).toISOString();

      // Fetch follower count
      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      // Fetch new followers in time range
      const { count: newFollowers } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id)
        .gte('created_at', startDate);

      // Fetch posts count
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch reels count
      const { count: reelsCount } = await supabase
        .from('reels')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch user's posts for engagement metrics
      const { data: posts } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user.id);

      const postIds = posts?.map(p => p.id) || [];

      // Fetch likes on user's posts
      let likesCount = 0;
      if (postIds.length > 0) {
        const { count } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds)
          .gte('created_at', startDate);
        likesCount = count || 0;
      }

      // Fetch comments on user's posts
      let commentsCount = 0;
      if (postIds.length > 0) {
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds)
          .gte('created_at', startDate);
        commentsCount = count || 0;
      }

      // Fetch saves on user's posts
      let savesCount = 0;
      if (postIds.length > 0) {
        const { count } = await supabase
          .from('saves')
          .select('*', { count: 'exact', head: true })
          .in('post_id', postIds)
          .gte('created_at', startDate);
        savesCount = count || 0;
      }

      // Calculate engagement rate
      const totalEngagements = likesCount + commentsCount + savesCount;
      const engagementRate = followersCount && followersCount > 0
        ? ((totalEngagements / (postIds.length || 1)) / followersCount) * 100
        : 0;

      // Estimate reach and views (simplified - in production you'd track these properly)
      const estimatedReach = Math.round((followersCount || 0) * 0.3 * (postsCount || 0));
      const estimatedViews = Math.round(estimatedReach * 1.5);

      setStats({
        totalFollowers: followersCount || 0,
        followerGrowth: newFollowers || 0,
        totalReach: estimatedReach,
        engagementRate: Math.round(engagementRate * 100) / 100,
        totalViews: estimatedViews,
        totalLikes: likesCount,
        totalComments: commentsCount,
        totalShares: 0, // Would need shares table
        totalSaves: savesCount,
        postsCount: postsCount || 0,
        reelsCount: reelsCount || 0,
        storiesCount: 0, // Stories expire, so this would need different logic
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Followers', value: stats.totalFollowers.toLocaleString(), icon: Users, color: 'text-blue-500', growth: stats.followerGrowth > 0 ? `+${stats.followerGrowth}` : null },
    { label: 'Reach', value: stats.totalReach.toLocaleString(), icon: Eye, color: 'text-green-500' },
    { label: 'Engagement', value: `${stats.engagementRate}%`, icon: TrendingUp, color: 'text-purple-500' },
    { label: 'Total Views', value: stats.totalViews.toLocaleString(), icon: Play, color: 'text-orange-500' },
  ];

  const engagementStats = [
    { label: 'Likes', value: stats.totalLikes, icon: Heart, color: 'text-red-500' },
    { label: 'Comments', value: stats.totalComments, icon: MessageCircle, color: 'text-blue-500' },
    { label: 'Shares', value: stats.totalShares, icon: Share2, color: 'text-green-500' },
    { label: 'Saves', value: stats.totalSaves, icon: Bookmark, color: 'text-yellow-500' },
  ];

  const contentStats = [
    { label: 'Posts', value: stats.postsCount, icon: Image },
    { label: 'Reels', value: stats.reelsCount, icon: Play },
    { label: 'Stories', value: stats.storiesCount, icon: Clock },
  ];

  const menuItems = [
    { label: 'Content Performance', description: 'View insights for each post', section: 'content' },
    { label: 'Audience Insights', description: 'Demographics & active hours', section: 'audience' },
    { label: 'Earnings', description: 'Revenue & payouts', section: 'earnings' },
    { label: 'Boost & Promote', description: 'Promote your content', section: 'boost' },
    { label: 'Content Manager', description: 'Manage all your posts', section: 'manager' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Creator Tools</h1>
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
        <div className="flex-1">
          <h1 className="font-semibold text-lg">Creator Tools</h1>
          <p className="text-sm text-muted-foreground">Analytics & Insights</p>
        </div>
        {profile?.is_verified && (
          <Badge variant="default" className="bg-primary">
            <span className="mr-1">✓</span> Verified
          </Badge>
        )}
      </header>

      {/* Time Range Selector */}
      <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
          <TabsTrigger value="90d">90 Days</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 rounded-xl bg-secondary/50 border"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stat.value}</span>
              {stat.growth && (
                <span className="text-xs text-green-500">{stat.growth}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Engagement Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-4 rounded-xl bg-secondary/50 border space-y-4"
      >
        <h3 className="font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Engagement Breakdown
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {engagementStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
              <p className="font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Content Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-xl bg-secondary/50 border space-y-4"
      >
        <h3 className="font-semibold">Your Content</h3>
        <div className="flex justify-around">
          {contentStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
              <p className="font-bold text-lg">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Menu Items */}
      <div className="space-y-2">
        {menuItems.map((item, index) => (
          <motion.button
            key={item.section}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            onClick={() => onOpenSection?.(item.section)}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-left"
          >
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
