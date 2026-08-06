import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, LayoutGrid, Film, Images, CircleDot, FileText, BarChart3, Users,
  Wallet, Megaphone, Users2, BadgeCheck, HeartHandshake, Sparkles, CalendarDays, Loader2, Lock,
  Briefcase, Code2,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

import { CreatorDashboard } from '@/components/creator/CreatorDashboard';
import { ContentManager } from '@/components/creator/ContentManager';
import { AudienceInsights } from '@/components/creator/AudienceInsights';
import { CreatorEarnings } from '@/components/creator/CreatorEarnings';
import { BoostCampaign } from '@/components/creator/BoostCampaign';
import { FanSubscriptions } from '@/components/creator/FanSubscriptions';
import { ContentCalendar } from '@/components/creator/ContentCalendar';
import { AIGrowthAssistant } from '@/components/creator/AIGrowthAssistant';
import { RealTimeAnalytics } from '@/components/creator/RealTimeAnalytics';
import { StoriesManager } from '@/components/studio/StoriesManager';
import { DraftManager } from '@/components/studio/DraftManager';
import { CollaborationManager } from '@/components/studio/CollaborationManager';
import { VerificationStatus } from '@/components/studio/VerificationStatus';
import { BrandMarketplace } from '@/components/studio/BrandMarketplace';
import { DeveloperPlatform } from '@/components/studio/DeveloperPlatform';

type SectionId =
  | 'overview' | 'content' | 'posts' | 'reels' | 'stories' | 'drafts'
  | 'analytics' | 'audience' | 'revenue' | 'promotions' | 'collaborations'
  | 'subscriptions' | 'verification' | 'calendar' | 'assistant'
  | 'marketplace' | 'developers';


const GROUPS: { title: string; items: { id: SectionId; label: string; description: string; icon: typeof LayoutGrid }[] }[] = [
  {
    title: 'Content',
    items: [
      { id: 'content', label: 'Content Manager', description: 'All posts and reels in one place', icon: LayoutGrid },
      { id: 'posts', label: 'Posts Manager', description: 'Photo posts and carousels', icon: Images },
      { id: 'reels', label: 'Reels Manager', description: 'Reels performance and cleanup', icon: Film },
      { id: 'stories', label: 'Stories Manager', description: 'Active stories and view counts', icon: CircleDot },
      { id: 'drafts', label: 'Draft Manager', description: 'Unpublished work in progress', icon: FileText },
      { id: 'calendar', label: 'Content Calendar', description: 'Plan what goes out and when', icon: CalendarDays },
    ],
  },
  {
    title: 'Insights',
    items: [
      { id: 'analytics', label: 'Creator Analytics', description: 'Real-time views, reach and engagement', icon: BarChart3 },
      { id: 'audience', label: 'Audience Insights', description: 'Who follows you and how you grow', icon: Users },
      { id: 'assistant', label: 'AI Growth Assistant', description: 'Personalised growth suggestions', icon: Sparkles },
    ],
  },
  {
    title: 'Business',
    items: [
      { id: 'revenue', label: 'Revenue Dashboard', description: 'Earnings, tips and payouts', icon: Wallet },
      { id: 'promotions', label: 'Promotions Manager', description: 'Boost campaigns and reach', icon: Megaphone },
      { id: 'subscriptions', label: 'Fan Subscriptions', description: 'Pricing, benefits and subscribers', icon: HeartHandshake },
      { id: 'collaborations', label: 'Collaboration Manager', description: 'Co-authored posts and invites', icon: Users2 },
      { id: 'marketplace', label: 'Brand Marketplace', description: 'Paid brand deals and applications', icon: Briefcase },
      { id: 'verification', label: 'Verification Status', description: 'Badge status and request history', icon: BadgeCheck },
    ],
  },
  {
    title: 'Developers',
    items: [
      { id: 'developers', label: 'Developer Platform', description: 'API keys, webhooks, apps, docs and sandbox', icon: Code2 },
    ],
  },
];


export default function StudioPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }) => { setIsAdmin(!!data); setChecking(false); });
  }, [user]);

  const accountType = ((profile as any)?.account_type ?? 'personal') as string;
  const eligible = useMemo(
    () => isAdmin || ['creator', 'business', 'professional'].includes(accountType),
    [isAdmin, accountType]
  );

  if (loading || checking) {
    return <MainLayout><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div></MainLayout>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const back = () => navigate('/studio');
  const current = (section as SectionId) || 'overview';

  const renderSection = () => {
    switch (current) {
      case 'content': return <ContentManager onBack={back} onBoost={(t, id) => navigate(`/studio/promotions?type=${t}&id=${id}`)} />;
      case 'posts':
      case 'reels': return <ContentManager onBack={back} />;
      case 'stories': return <StoriesManager onBack={back} />;
      case 'drafts': return <DraftManager onBack={back} />;
      case 'calendar': return <ContentCalendar onBack={back} />;
      case 'analytics': return <RealTimeAnalytics onBack={back} />;
      case 'audience': return <AudienceInsights onBack={back} />;
      case 'assistant': return <AIGrowthAssistant onBack={back} />;
      case 'revenue': return <CreatorEarnings onBack={back} />;
      case 'promotions': return <BoostCampaign onBack={back} />;
      case 'subscriptions': return <FanSubscriptions onBack={back} />;
      case 'collaborations': return <CollaborationManager onBack={back} />;
      case 'verification': return <VerificationStatus onBack={back} />;
      default: return <CreatorDashboard onBack={() => navigate(-1)} onOpenSection={(s) => navigate(`/studio/${s}`)} />;
    }
  };

  return (
    <MainLayout>
      <Seo
        title="Openflip Studio — Creator & Business Dashboard"
        description="Openflip Studio brings your posts, reels, stories and drafts together with real-time analytics, audience insights, revenue, promotions, fan subscriptions and verification status in one creator workspace."
        path="/studio"
      />
      <div className="max-w-5xl mx-auto p-4 pb-24">
        {!eligible ? (
          <div className="text-center py-20 space-y-4">
            <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
            <div>
              <h1 className="text-xl font-semibold">Openflip Studio</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Studio is available for creator and business accounts. Switch your account type to unlock content managers, analytics and monetisation tools.
              </p>
            </div>
            <Button onClick={() => navigate('/settings/account')}>Switch account type</Button>
          </div>
        ) : current !== 'overview' ? (
          renderSection()
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
              <div>
                <h1 className="text-2xl font-bold">Openflip Studio</h1>
                <p className="text-sm text-muted-foreground">Everything you need to manage and grow your presence</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4">
              <CreatorDashboard onBack={() => navigate(-1)} onOpenSection={(s) => navigate(`/studio/${s}`)} />
            </div>

            {GROUPS.map((group) => (
              <section key={group.title} className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.items.map(({ id, label, description, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => navigate(`/studio/${id}`)}
                      className="text-left p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                        <Icon className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
