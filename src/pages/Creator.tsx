import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';
import { CreatorDashboard } from '@/components/creator/CreatorDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';

export default function CreatorPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <MainLayout>
      <Seo title="Creator Dashboard — Openflip" description="Track your Openflip growth with the Creator Dashboard: real-time analytics, earnings and payouts, audience insights, and tools to grow your following faster." path="/creator" />
      <div className="max-w-5xl mx-auto p-4">
        <CreatorDashboard onBack={() => navigate(-1)} />
      </div>
    </MainLayout>
  );
}
