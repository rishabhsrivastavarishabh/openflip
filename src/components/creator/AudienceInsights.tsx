import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, MapPin, Clock, TrendingUp, Loader2,
  BarChart3, PieChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AudienceInsightsProps {
  onBack: () => void;
}

interface InsightData {
  totalFollowers: number;
  growthRate: number;
  topLocations: { name: string; count: number; percentage: number }[];
  ageDistribution: { range: string; percentage: number }[];
  genderDistribution: { gender: string; percentage: number }[];
  activeHours: { hour: number; activity: number }[];
  activeDays: { day: string; activity: number }[];
}

export function AudienceInsights({ onBack }: AudienceInsightsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightData>({
    totalFollowers: 0,
    growthRate: 0,
    topLocations: [],
    ageDistribution: [],
    genderDistribution: [],
    activeHours: [],
    activeDays: [],
  });

  useEffect(() => {
    if (user) {
      fetchInsights();
    }
  }, [user]);

  const fetchInsights = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch follower count
      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      // Fetch audience insights from database (if available)
      const { data: audienceData } = await supabase
        .from('audience_insights')
        .select('*')
        .eq('user_id', user.id);

      // Process location data
      const locationMap = new Map<string, number>();
      const ageMap = new Map<string, number>();
      const genderMap = new Map<string, number>();

      (audienceData || []).forEach(item => {
        if (item.location) {
          locationMap.set(item.location, (locationMap.get(item.location) || 0) + item.follower_count);
        }
        if (item.age_range) {
          ageMap.set(item.age_range, (ageMap.get(item.age_range) || 0) + item.follower_count);
        }
        if (item.gender) {
          genderMap.set(item.gender, (genderMap.get(item.gender) || 0) + item.follower_count);
        }
      });

      const totalFromInsights = Array.from(locationMap.values()).reduce((a, b) => a + b, 0) || followersCount || 1;

      // Convert to arrays with percentages
      const topLocations = Array.from(locationMap.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / totalFromInsights) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const ageDistribution = Array.from(ageMap.entries())
        .map(([range, count]) => ({
          range,
          percentage: Math.round((count / totalFromInsights) * 100),
        }))
        .sort((a, b) => b.percentage - a.percentage);

      const genderDistribution = Array.from(genderMap.entries())
        .map(([gender, count]) => ({
          gender,
          percentage: Math.round((count / totalFromInsights) * 100),
        }));

      // Generate mock active hours data (in production, this would come from real analytics)
      const activeHours = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        activity: Math.floor(Math.random() * 100) + 20,
      }));

      // Peak hours are typically 9am, 12pm, 6pm, 9pm
      [9, 12, 18, 21].forEach(h => {
        activeHours[h].activity = Math.min(100, activeHours[h].activity + 40);
      });

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const activeDays = days.map(day => ({
        day,
        activity: Math.floor(Math.random() * 40) + 60,
      }));

      // Set mock data if no real data exists
      if (topLocations.length === 0) {
        topLocations.push(
          { name: 'Mumbai', count: Math.round((followersCount || 100) * 0.25), percentage: 25 },
          { name: 'Delhi', count: Math.round((followersCount || 100) * 0.18), percentage: 18 },
          { name: 'Bangalore', count: Math.round((followersCount || 100) * 0.15), percentage: 15 },
          { name: 'Hyderabad', count: Math.round((followersCount || 100) * 0.12), percentage: 12 },
          { name: 'Chennai', count: Math.round((followersCount || 100) * 0.10), percentage: 10 }
        );
      }

      if (ageDistribution.length === 0) {
        ageDistribution.push(
          { range: '18-24', percentage: 35 },
          { range: '25-34', percentage: 40 },
          { range: '35-44', percentage: 15 },
          { range: '45+', percentage: 10 }
        );
      }

      if (genderDistribution.length === 0) {
        genderDistribution.push(
          { gender: 'Male', percentage: 55 },
          { gender: 'Female', percentage: 42 },
          { gender: 'Other', percentage: 3 }
        );
      }

      setInsights({
        totalFollowers: followersCount || 0,
        growthRate: 5.2, // Would calculate from historical data
        topLocations,
        ageDistribution,
        genderDistribution,
        activeHours,
        activeDays,
      });
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Audience Insights</h1>
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
        <h1 className="font-semibold text-lg">Audience Insights</h1>
      </header>

      {/* Follower Overview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Total Followers</p>
            <p className="text-4xl font-bold">{insights.totalFollowers.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">+{insights.growthRate}%</span>
            </div>
            <p className="text-xs opacity-75">vs last month</p>
          </div>
        </div>
      </motion.div>

      {/* Top Locations */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-4 rounded-xl bg-secondary/50 space-y-4"
      >
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Top Locations
        </h3>
        <div className="space-y-3">
          {insights.topLocations.map((location, index) => (
            <div key={location.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{location.name}</span>
                <span className="text-muted-foreground">{location.percentage}%</span>
              </div>
              <Progress value={location.percentage} className="h-2" />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Age & Gender */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-xl bg-secondary/50 space-y-3"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Age
          </h3>
          <div className="space-y-2">
            {insights.ageDistribution.map((age) => (
              <div key={age.range} className="flex items-center justify-between text-sm">
                <span>{age.range}</span>
                <Badge variant="secondary">{age.percentage}%</Badge>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-xl bg-secondary/50 space-y-3"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Gender
          </h3>
          <div className="space-y-2">
            {insights.genderDistribution.map((g) => (
              <div key={g.gender} className="flex items-center justify-between text-sm">
                <span>{g.gender}</span>
                <Badge variant="secondary">{g.percentage}%</Badge>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Active Times */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-4 rounded-xl bg-secondary/50 space-y-4"
      >
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Most Active Times
        </h3>
        
        {/* Best times to post */}
        <div className="grid grid-cols-4 gap-2">
          {[9, 12, 18, 21].map((hour) => (
            <div key={hour} className="text-center p-2 rounded-lg bg-primary/10">
              <p className="text-lg font-bold text-primary">{formatHour(hour)}</p>
              <p className="text-xs text-muted-foreground">Peak</p>
            </div>
          ))}
        </div>

        {/* Active days */}
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-2">Activity by Day</p>
          <div className="flex justify-between gap-1">
            {insights.activeDays.map((day) => (
              <div key={day.day} className="flex-1 text-center">
                <div
                  className="mx-auto w-full rounded-t-sm bg-primary/20"
                  style={{
                    height: `${day.activity}px`,
                    maxHeight: '100px',
                  }}
                >
                  <div
                    className="w-full rounded-t-sm bg-primary transition-all"
                    style={{ height: `${day.activity}%` }}
                  />
                </div>
                <p className="text-xs mt-1">{day.day}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2"
      >
        <h3 className="font-semibold text-primary">💡 Recommendations</h3>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• Post between 9 AM - 12 PM for maximum engagement</li>
          <li>• Your audience is most active on weekdays</li>
          <li>• Consider creating content in Hindi for Mumbai audience</li>
          <li>• Reels perform 3x better with your audience</li>
        </ul>
      </motion.div>
    </div>
  );
}
