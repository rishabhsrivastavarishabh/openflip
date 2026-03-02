import { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, Clock, Hash, TrendingUp, Zap, BarChart3, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface AIGrowthAssistantProps {
  onBack: () => void;
}

interface Tip {
  icon: typeof Sparkles;
  title: string;
  content: string;
  category: string;
}

export function AIGrowthAssistant({ onBack }: AIGrowthAssistantProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState<Tip[]>([]);
  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [askingAI, setAskingAI] = useState(false);
  const [stats, setStats] = useState({ followers: 0, posts: 0, reels: 0, engagement: 0 });

  useEffect(() => {
    if (user) generateInsights();
  }, [user]);

  const generateInsights = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch real data
      const [followersRes, postsRes, reelsRes, likesRes] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('posts').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('reels').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('posts').select('id').eq('user_id', user.id).then(async ({ data: posts }) => {
          if (!posts?.length) return { count: 0 };
          const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).in('post_id', posts.map(p => p.id));
          return { count: count || 0 };
        }),
      ]);

      const followers = followersRes.count || 0;
      const posts = postsRes.count || 0;
      const reels = reelsRes.count || 0;
      const likes = (likesRes as any).count || 0;
      const engagement = posts > 0 && followers > 0 ? Math.round(((likes / posts) / followers) * 10000) / 100 : 0;

      setStats({ followers, posts, reels, engagement });

      // Generate personalized tips based on data
      const generatedTips: Tip[] = [];

      // Best posting times
      const hour = new Date().getHours();
      const bestTimes = hour < 12
        ? ['12:00 PM - 2:00 PM', '6:00 PM - 9:00 PM']
        : ['8:00 AM - 10:00 AM', '7:00 PM - 9:00 PM'];
      
      generatedTips.push({
        icon: Clock,
        title: 'Best Posting Times',
        content: `Based on general engagement patterns, try posting at ${bestTimes.join(' or ')}. Weekdays tend to see 15-20% more engagement.`,
        category: 'Timing',
      });

      // Hashtag suggestions
      generatedTips.push({
        icon: Hash,
        title: 'Hashtag Strategy',
        content: `Use 5-10 relevant hashtags per post. Mix popular tags (#explore, #trending) with niche ones. Avoid banned or overly saturated hashtags. Create a branded hashtag for your content.`,
        category: 'Hashtags',
      });

      // Reel optimization
      if (reels < 5) {
        generatedTips.push({
          icon: Zap,
          title: 'Start Creating Reels',
          content: `You have ${reels} reels. Reels get 2-3x more reach than regular posts. Aim for 15-30 second videos with trending audio. Post at least 3-4 reels per week.`,
          category: 'Reels',
        });
      } else {
        generatedTips.push({
          icon: Zap,
          title: 'Reel Growth Tips',
          content: `Great job with ${reels} reels! Hook viewers in the first 3 seconds. Use text overlays. End with a call-to-action. Trending audio boosts discovery by 40%.`,
          category: 'Reels',
        });
      }

      // Content performance
      generatedTips.push({
        icon: BarChart3,
        title: 'Content Performance',
        content: engagement > 3
          ? `Your ${engagement}% engagement rate is excellent! You're above average. Keep focusing on quality content and community interaction.`
          : `Your engagement rate is ${engagement}%. To improve: reply to every comment, use carousel posts, ask questions in captions, and post consistently.`,
        category: 'Performance',
      });

      // Growth strategy
      generatedTips.push({
        icon: TrendingUp,
        title: 'Growth Strategy',
        content: followers < 100
          ? `With ${followers} followers, focus on consistency. Post daily, engage with 20+ accounts in your niche, collaborate with similar creators, and use Stories to stay visible.`
          : `With ${followers} followers, consider: cross-promoting on other platforms, hosting live sessions, creating shareable content, and using the Boost feature for key posts.`,
        category: 'Growth',
      });

      setTips(generatedTips);
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const askAI = async () => {
    if (!question.trim()) return;
    setAskingAI(true);
    setAiResponse('');

    // Simulate AI response based on keywords
    await new Promise(r => setTimeout(r, 1500));

    const q = question.toLowerCase();
    let response = '';

    if (q.includes('hashtag')) {
      response = `For your niche, try these hashtag groups:\n\n🔥 High reach: #explore #trending #viral #fyp\n🎯 Niche: Use 3-5 tags specific to your content topic\n🏷️ Branded: Create a unique tag like #YourName\n\nRotate hashtag sets every few posts to avoid shadowbanning. Use 8-12 hashtags per post for optimal reach.`;
    } else if (q.includes('post') || q.includes('time') || q.includes('when')) {
      response = `Best posting schedule:\n\n📅 Monday-Friday: 12 PM, 5-6 PM\n📅 Saturday: 10 AM, 2 PM\n📅 Sunday: 11 AM, 4 PM\n\nConsistency matters more than perfect timing. Pick 2-3 slots and stick with them. Your audience will learn when to expect your content.`;
    } else if (q.includes('reel') || q.includes('video')) {
      response = `Reel optimization tips:\n\n⚡ Hook in first 1-3 seconds\n🎵 Use trending audio (check Explore)\n📝 Add text overlays for accessibility\n⏱️ Aim for 15-30 seconds\n🔄 Post 4-7 reels per week\n💬 End with a question to boost comments\n\nReels are currently the highest-reach format on most platforms.`;
    } else if (q.includes('grow') || q.includes('follower')) {
      response = `Growth strategy for your account:\n\n1. 📊 Post consistently (daily or 5x/week)\n2. 💬 Engage genuinely with 30+ accounts daily\n3. 🤝 Collaborate with creators in your niche\n4. 📱 Use Stories daily for visibility\n5. 🎥 Prioritize Reels for discovery\n6. #️⃣ Optimize hashtags each post\n7. 🔄 Cross-promote on other platforms`;
    } else {
      response = `Here are some general tips based on your account:\n\n• You have ${stats.followers} followers and ${stats.posts} posts\n• Your engagement rate is ${stats.engagement}%\n• Focus on creating content your audience saves and shares\n• Use the Creator Tools dashboard to track what works\n• Try different content formats and analyze results\n\nAsk me about hashtags, posting times, reels, or growth strategies!`;
    }

    setAiResponse(response);
    setAskingAI(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">AI Growth Assistant</h1>
        </header>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Analyzing your account..." />
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
          <h1 className="font-semibold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Growth Assistant
          </h1>
          <p className="text-sm text-muted-foreground">Personalized tips for your account</p>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Followers', value: stats.followers },
          { label: 'Posts', value: stats.posts },
          { label: 'Reels', value: stats.reels },
          { label: 'Engage', value: `${stats.engagement}%` },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-secondary/50 border text-center">
            <p className="font-bold text-lg">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* AI Tips */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase">Personalized Insights</h3>
        {tips.map((tip, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl bg-secondary/50 border space-y-2"
          >
            <div className="flex items-center gap-2">
              <tip.icon className="w-4 h-4 text-primary" />
              <span className="font-medium">{tip.title}</span>
              <Badge variant="secondary" className="text-xs ml-auto">{tip.category}</Badge>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{tip.content}</p>
          </motion.div>
        ))}
      </div>

      {/* Ask AI */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase">Ask AI</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Ask about hashtags, posting times, growth..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askAI()}
          />
          <Button size="icon" onClick={askAI} disabled={askingAI || !question.trim()}>
            {askingAI ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Quick Questions */}
        <div className="flex flex-wrap gap-2">
          {['Best posting times?', 'Hashtag tips', 'How to grow?', 'Reel strategy'].map(q => (
            <button
              key={q}
              onClick={() => { setQuestion(q); }}
              className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {aiResponse && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm text-primary">AI Response</span>
              </div>
              <p className="text-sm whitespace-pre-line">{aiResponse}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
