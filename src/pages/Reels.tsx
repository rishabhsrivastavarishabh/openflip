import { MainLayout } from '@/components/layout/MainLayout';
import { ReelsFeed } from '@/components/reels/ReelsFeed';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Reels() {
  const [activeTab, setActiveTab] = useState<'foryou' | 'trending'>('foryou');

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <h1 className="text-xl font-bold text-white">Reels</h1>
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="bg-white/10">
              <TabsTrigger value="foryou" className="text-white data-[state=active]:bg-white/20">
                For You
              </TabsTrigger>
              <TabsTrigger value="trending" className="text-white data-[state=active]:bg-white/20">
                <TrendingUp className="w-4 h-4 mr-1" />
                Trending
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Link to="/create/reel">
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/10">
              <Plus className="w-6 h-6" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1">
        <ReelsFeed />
      </div>
    </div>
  );
}
