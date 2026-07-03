import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Tag, BadgeCheck, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { VerificationPanel } from '@/components/admin/VerificationPanel';
import { AdminPromoManager } from '@/components/admin/AdminPromoManager';
import { AdminSubscribersPanel } from '@/components/admin/AdminSubscribersPanel';

export default function AdminPage() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showPromos, setShowPromos] = useState(false);
  const [showSubs, setShowSubs] = useState(false);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data);
        setChecking(false);
      });
  }, [user]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/settings/account" replace />;

  if (showPromos) {
    return <AdminPromoManager onBack={() => setShowPromos(false)} />;
  }

  const tiles = [
    {
      icon: BadgeCheck,
      title: 'Verification requests',
      description: 'Review and approve verified accounts',
      action: () => setShowVerification(true),
    },
    {
      icon: Tag,
      title: 'Promo codes',
      description: 'Create and manage discount codes',
      action: () => setShowPromos(true),
    },
    {
      icon: Users,
      title: 'Subscribers',
      description: 'View active and past subscribers',
      action: () => setShowSubs(true),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg leading-tight">Admin control</h2>
            <p className="text-xs text-muted-foreground">Backend tools available to your role</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.title}
              onClick={t.action}
              className="glass-card rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-secondary/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <VerificationPanel open={showVerification} onOpenChange={setShowVerification} />
      {showSubs && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4">
            <Button variant="ghost" onClick={() => setShowSubs(false)} className="mb-3">← Back</Button>
            <AdminSubscribersPanel />
          </div>
        </div>
      )}
    </div>
  );
}
