import { useState, useEffect } from 'react';
import { ArrowLeft, Crown, Users, TrendingUp, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  onBack: () => void;
}

export function FanSubscriptions({ onBack }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, earnings: 0, active: 0 });
  const [monthlyPrice, setMonthlyPrice] = useState('49');
  const [yearlyPrice, setYearlyPrice] = useState('490');
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch settings
    const { data: settingsData } = await (supabase as any)
      .from('creator_subscription_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsData) {
      setSettings(settingsData);
      setIsEnabled(settingsData.is_enabled);
      setMonthlyPrice(String(settingsData.monthly_price));
      setYearlyPrice(String(settingsData.yearly_price));
    }

    // Fetch subscribers
    const { data: subsData } = await (supabase as any)
      .from('creator_subscriptions')
      .select('*')
      .eq('creator_id', user.id)
      .eq('status', 'active');

    if (subsData) {
      setSubscribers(subsData);
      const totalEarnings = subsData.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
      setStats({ total: subsData.length, earnings: totalEarnings, active: subsData.length });
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      is_enabled: isEnabled,
      monthly_price: Number(monthlyPrice),
      yearly_price: Number(yearlyPrice),
    };

    if (settings) {
      await (supabase as any)
        .from('creator_subscription_settings')
        .update(payload)
        .eq('user_id', user.id);
    } else {
      await (supabase as any)
        .from('creator_subscription_settings')
        .insert(payload);
    }

    toast.success('Fan subscription settings saved!');
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Fan Subscriptions</h1>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-primary/5 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Subscribers</p>
          </div>
          <div className="p-4 rounded-xl bg-primary/5 text-center">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold">₹{stats.earnings}</p>
            <p className="text-xs text-muted-foreground">Earnings</p>
          </div>
          <div className="p-4 rounded-xl bg-primary/5 text-center">
            <Star className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold">{stats.active}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
        </div>

        <Separator />

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Enable Fan Subscriptions</p>
              <p className="text-sm text-muted-foreground">Let fans subscribe to exclusive content</p>
            </div>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        {isEnabled && (
          <>
            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="font-semibold">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly (₹)</Label>
                  <Input type="number" value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} min="1" />
                </div>
                <div className="space-y-2">
                  <Label>Yearly (₹)</Label>
                  <Input type="number" value={yearlyPrice} onChange={e => setYearlyPrice(e.target.value)} min="1" />
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-3">
              <h3 className="font-semibold">Subscriber Benefits</h3>
              {['Exclusive posts', 'Exclusive reels', 'Subscriber-only stories', 'Badge on comments'].map(benefit => (
                <div key={benefit} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Star className="w-4 h-4 text-primary" />
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <Button variant="gradient" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
