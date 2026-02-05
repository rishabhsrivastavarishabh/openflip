 import { useState, useEffect } from 'react';
 import { motion } from 'framer-motion';
 import {
   ArrowLeft, TrendingUp, Eye, Heart, MessageCircle,
   Share2, Bookmark, Users, BarChart3, Calendar,
   ChevronDown
 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { useAuth } from '@/contexts/AuthContext';
 import { supabase } from '@/integrations/supabase/client';
 import { LoadingSpinner } from '@/components/ui/loading-spinner';
 import { format, subDays, startOfDay, endOfDay } from 'date-fns';
 import {
   LineChart, Line, XAxis, YAxis, CartesianGrid,
   Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar
 } from 'recharts';
 
 interface RealTimeAnalyticsProps {
   onBack: () => void;
 }
 
 interface AnalyticsSummary {
   totalViews: number;
   totalReach: number;
   totalLikes: number;
   totalComments: number;
   totalShares: number;
   totalSaves: number;
   followerGrowth: number;
   profileVisits: number;
 }
 
 interface DailyData {
   date: string;
   views: number;
   likes: number;
   comments: number;
   reach: number;
 }
 
 export function RealTimeAnalytics({ onBack }: RealTimeAnalyticsProps) {
   const { user } = useAuth();
   const [loading, setLoading] = useState(true);
   const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
   const [summary, setSummary] = useState<AnalyticsSummary>({
     totalViews: 0,
     totalReach: 0,
     totalLikes: 0,
     totalComments: 0,
     totalShares: 0,
     totalSaves: 0,
     followerGrowth: 0,
     profileVisits: 0,
   });
   const [dailyData, setDailyData] = useState<DailyData[]>([]);
   const [topContent, setTopContent] = useState<any[]>([]);
 
   useEffect(() => {
     if (user) {
       fetchAnalytics();
     }
   }, [user, period]);
 
   const fetchAnalytics = async () => {
     if (!user) return;
     setLoading(true);
 
     try {
       const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
       const startDate = subDays(new Date(), days);
 
       // Fetch content analytics
       const { data: analyticsData } = await supabase
         .from('content_analytics')
         .select('*')
         .eq('user_id', user.id)
         .gte('recorded_at', startDate.toISOString());
 
       // Calculate totals from real data
       const totals = (analyticsData || []).reduce(
         (acc, item) => ({
           totalViews: acc.totalViews + (item.views || 0),
           totalReach: acc.totalReach + (item.reach || 0),
           totalLikes: acc.totalLikes + (item.likes || 0),
           totalComments: acc.totalComments + (item.comments || 0),
           totalShares: acc.totalShares + (item.shares || 0),
           totalSaves: acc.totalSaves + (item.saves || 0),
           followerGrowth: acc.followerGrowth + (item.follows_gained || 0),
           profileVisits: acc.profileVisits + (item.profile_visits || 0),
         }),
         {
           totalViews: 0,
           totalReach: 0,
           totalLikes: 0,
           totalComments: 0,
           totalShares: 0,
           totalSaves: 0,
           followerGrowth: 0,
           profileVisits: 0,
         }
       );
 
       // Fetch real likes count
       const { count: likesCount } = await supabase
         .from('likes')
         .select('*, posts!inner(user_id)', { count: 'exact', head: true })
         .eq('posts.user_id', user.id)
         .gte('created_at', startDate.toISOString());
 
       // Fetch real comments count
       const { count: commentsCount } = await supabase
         .from('comments')
         .select('*, posts!inner(user_id)', { count: 'exact', head: true })
         .eq('posts.user_id', user.id)
         .gte('created_at', startDate.toISOString());
 
       // Fetch follower growth
       const { count: newFollowers } = await supabase
         .from('follows')
         .select('*', { count: 'exact', head: true })
         .eq('following_id', user.id)
         .gte('created_at', startDate.toISOString());
 
       // Fetch saves
       const { count: savesCount } = await supabase
         .from('saves')
         .select('*, posts!inner(user_id)', { count: 'exact', head: true })
         .eq('posts.user_id', user.id)
         .gte('created_at', startDate.toISOString());
 
       setSummary({
         ...totals,
         totalLikes: likesCount || totals.totalLikes,
         totalComments: commentsCount || totals.totalComments,
         totalSaves: savesCount || totals.totalSaves,
         followerGrowth: newFollowers || 0,
       });
 
       // Generate daily data from real metrics
       const dailyMap = new Map<string, DailyData>();
       for (let i = 0; i < days; i++) {
         const date = format(subDays(new Date(), i), 'MMM dd');
         dailyMap.set(date, { date, views: 0, likes: 0, comments: 0, reach: 0 });
       }
 
       (analyticsData || []).forEach(item => {
         const date = format(new Date(item.recorded_at), 'MMM dd');
         const existing = dailyMap.get(date);
         if (existing) {
           existing.views += item.views || 0;
           existing.likes += item.likes || 0;
           existing.comments += item.comments || 0;
           existing.reach += item.reach || 0;
         }
       });
 
       setDailyData(Array.from(dailyMap.values()).reverse());
 
       // Fetch top performing content
       const { data: topPosts } = await supabase
         .from('content_analytics')
         .select('*, posts(id, media_url, caption), reels(id, video_url, caption)')
         .eq('user_id', user.id)
         .order('views', { ascending: false })
         .limit(5);
 
       setTopContent(topPosts || []);
     } catch (error) {
       console.error('Error fetching analytics:', error);
     } finally {
       setLoading(false);
     }
   };
 
   if (loading) {
     return (
       <div className="space-y-6">
         <header className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={onBack}>
             <ArrowLeft className="h-5 w-5" />
           </Button>
           <h1 className="font-semibold text-lg">Analytics</h1>
         </header>
         <div className="flex items-center justify-center py-12">
           <LoadingSpinner size="lg" text="Loading analytics..." />
         </div>
       </div>
     );
   }
 
   const statCards = [
     { label: 'Views', value: summary.totalViews, icon: Eye, color: 'text-blue-500' },
     { label: 'Likes', value: summary.totalLikes, icon: Heart, color: 'text-red-500' },
     { label: 'Comments', value: summary.totalComments, icon: MessageCircle, color: 'text-green-500' },
     { label: 'Shares', value: summary.totalShares, icon: Share2, color: 'text-purple-500' },
     { label: 'Saves', value: summary.totalSaves, icon: Bookmark, color: 'text-yellow-500' },
     { label: 'New Followers', value: summary.followerGrowth, icon: Users, color: 'text-primary' },
   ];
 
   return (
     <div className="space-y-6">
       <header className="flex items-center justify-between">
         <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={onBack}>
             <ArrowLeft className="h-5 w-5" />
           </Button>
           <h1 className="font-semibold text-lg">Analytics</h1>
         </div>
         <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
           <SelectTrigger className="w-[120px]">
             <SelectValue />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="7d">Last 7 days</SelectItem>
             <SelectItem value="30d">Last 30 days</SelectItem>
             <SelectItem value="90d">Last 90 days</SelectItem>
           </SelectContent>
         </Select>
       </header>
 
       {/* Stats Grid */}
       <div className="grid grid-cols-3 gap-3">
         {statCards.map((stat, index) => (
           <motion.div
             key={stat.label}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: index * 0.05 }}
             className="p-3 rounded-xl bg-secondary/50 text-center"
           >
             <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
             <p className="text-lg font-bold">{stat.value.toLocaleString()}</p>
             <p className="text-xs text-muted-foreground">{stat.label}</p>
           </motion.div>
         ))}
       </div>
 
       {/* Charts */}
       <Tabs defaultValue="views">
         <TabsList className="grid grid-cols-4 w-full">
           <TabsTrigger value="views">Views</TabsTrigger>
           <TabsTrigger value="engagement">Engagement</TabsTrigger>
           <TabsTrigger value="reach">Reach</TabsTrigger>
           <TabsTrigger value="growth">Growth</TabsTrigger>
         </TabsList>
 
         <TabsContent value="views" className="mt-4">
           <div className="h-[200px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={dailyData}>
                 <defs>
                   <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                     <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                 <XAxis dataKey="date" className="text-xs" />
                 <YAxis className="text-xs" />
                 <Tooltip
                   contentStyle={{
                     backgroundColor: 'hsl(var(--background))',
                     border: '1px solid hsl(var(--border))',
                     borderRadius: '8px',
                   }}
                 />
                 <Area
                   type="monotone"
                   dataKey="views"
                   stroke="hsl(var(--primary))"
                   fill="url(#viewsGradient)"
                   strokeWidth={2}
                 />
               </AreaChart>
             </ResponsiveContainer>
           </div>
         </TabsContent>
 
         <TabsContent value="engagement" className="mt-4">
           <div className="h-[200px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={dailyData}>
                 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                 <XAxis dataKey="date" className="text-xs" />
                 <YAxis className="text-xs" />
                 <Tooltip
                   contentStyle={{
                     backgroundColor: 'hsl(var(--background))',
                     border: '1px solid hsl(var(--border))',
                     borderRadius: '8px',
                   }}
                 />
                 <Bar dataKey="likes" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                 <Bar dataKey="comments" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
         </TabsContent>
 
         <TabsContent value="reach" className="mt-4">
           <div className="h-[200px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={dailyData}>
                 <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                 <XAxis dataKey="date" className="text-xs" />
                 <YAxis className="text-xs" />
                 <Tooltip
                   contentStyle={{
                     backgroundColor: 'hsl(var(--background))',
                     border: '1px solid hsl(var(--border))',
                     borderRadius: '8px',
                   }}
                 />
                 <Line
                   type="monotone"
                   dataKey="reach"
                   stroke="hsl(var(--accent))"
                   strokeWidth={2}
                   dot={false}
                 />
               </LineChart>
             </ResponsiveContainer>
           </div>
         </TabsContent>
 
         <TabsContent value="growth" className="mt-4">
           <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 text-center">
             <TrendingUp className="w-12 h-12 mx-auto mb-3 text-primary" />
             <p className="text-3xl font-bold text-primary">+{summary.followerGrowth}</p>
             <p className="text-muted-foreground">New followers this period</p>
           </div>
         </TabsContent>
       </Tabs>
 
       {/* Top Content */}
       {topContent.length > 0 && (
         <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3 }}
           className="space-y-3"
         >
           <h3 className="font-semibold flex items-center gap-2">
             <BarChart3 className="w-4 h-4" />
             Top Performing Content
           </h3>
           <div className="space-y-2">
             {topContent.map((item, index) => (
               <div
                 key={item.id}
                 className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50"
               >
                 <span className="text-lg font-bold text-muted-foreground w-6">
                   #{index + 1}
                 </span>
                 <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
                   {item.posts?.media_url && (
                     <img
                       src={item.posts.media_url}
                       alt=""
                       className="w-full h-full object-cover"
                     />
                   )}
                 </div>
                 <div className="flex-1 min-w-0">
                   <p className="text-sm font-medium truncate">
                     {item.posts?.caption || item.reels?.caption || 'Untitled'}
                   </p>
                   <div className="flex items-center gap-3 text-xs text-muted-foreground">
                     <span>{item.views || 0} views</span>
                     <span>{item.likes || 0} likes</span>
                   </div>
                 </div>
               </div>
             ))}
           </div>
         </motion.div>
       )}
     </div>
   );
 }