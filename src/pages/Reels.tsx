import { ReelsFeed } from '@/components/reels/ReelsFeed';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobileAppFrame } from '@/components/layout/MobileAppFrame';

export default function Reels() {
  const [activeTab, setActiveTab] = useState<'foryou' | 'trending'>('foryou');

  return (
    <MobileAppFrame fullBleed>
      <div className="h-full bg-black flex flex-col relative">
        {/* Header - Floating */}
        <div className="absolute top-0 left-0 right-0 z-50 p-4 pt-8 md:pt-10 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
          <h1 className="text-xl font-bold text-white pointer-events-auto">Reels</h1>
          <div className="flex items-center gap-2 pointer-events-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="bg-white/10 backdrop-blur-sm">
                <TabsTrigger value="foryou" className="text-white data-[state=active]:bg-white/20 text-xs">
                  For You
                </TabsTrigger>
                <TabsTrigger value="trending" className="text-white data-[state=active]:bg-white/20 text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Trending
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Link to="/create/reel">
              <Button size="icon" variant="ghost" className="text-white hover:bg-white/10 h-8 w-8">
                <Plus className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Full-screen Feed */}
        <div className="flex-1 h-full">
          <ReelsFeed />
        </div>
      </div>
    </MobileAppFrame>
  );
}
