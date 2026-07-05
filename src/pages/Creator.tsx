import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';
import { CreatorDashboard } from '@/components/creator/CreatorDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function CreatorPage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <MainLayout>
      <Seo title="Creator Dashboard — Openflip" description="Analytics, earnings, audience insights and growth tools for your Openflip account." path="/creator" />
      <div className="max-w-5xl mx-auto p-4">
        <CreatorDashboard />
      </div>
    </MainLayout>
  );
}
