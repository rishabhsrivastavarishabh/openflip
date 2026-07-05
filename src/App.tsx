import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function RootRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // If Supabase redirected the recovery link to the Site URL root instead of
  // /reset-password (e.g. because the redirect_to wasn't in the allow list),
  // forward the recovery params so the reset flow still works.
  const search = location.search || window.location.search;
  const hash = location.hash || window.location.hash;
  const isRecovery =
    /(^|[?&])type=recovery(&|$)/.test(search) ||
    /(^|[#&])type=recovery(&|$)/.test(hash) ||
    (/(^|[?&])code=/.test(search) && /recovery/i.test(hash + search));

  if (isRecovery) {
    return <Navigate to={`/reset-password${search}${hash}`} replace />;
  }

  if (loading) return null;
  return user ? <Feed /> : <Navigate to="/auth" replace />;
}
import { AuthProvider } from "@/contexts/AuthContext";
import { MultiAccountProvider } from "@/contexts/MultiAccountContext";
import { PushNotificationProvider } from "@/components/PushNotificationProvider";
import { OnboardingSuggestions } from "@/components/onboarding/OnboardingSuggestions";
import Feed from "./pages/Feed";
import Auth from "./pages/Auth";
import Explore from "./pages/Explore";
import Create from "./pages/Create";
import Profile from "./pages/Profile";
import Post from "./pages/Post";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Conversation from "./pages/Conversation";
import Settings from "./pages/Settings";
import SettingsLayout from "./pages/settings/SettingsLayout";
import AccountPage from "./pages/settings/AccountPage";
import SecurityPage from "./pages/settings/SecurityPage";
import PrivacyPage from "./pages/settings/PrivacyPage";
import NotificationsPage from "./pages/settings/NotificationsPage";
import AppearancePage from "./pages/settings/AppearancePage";
import TwoFactorPage from "./pages/settings/TwoFactorPage";
import AdminPage from "./pages/settings/AdminPage";

import Reels from "./pages/Reels";
import Followers from "./pages/Followers";
import Following from "./pages/Following";
import Search from "./pages/Search";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import HowItWorks from "./pages/HowItWorks";
import { CreateReel } from "./components/reels/CreateReel";
import AccountCenter from "./pages/AccountCenter";
import ResetPassword from "./pages/ResetPassword";
import Call from "./pages/Call";
import Meet from "./pages/Meet";
import { IncomingCallDialog } from "./components/calls/IncomingCallDialog";
import { useAuth as useAuthForCall } from "@/contexts/AuthContext";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";
import Creator from "./pages/Creator";
import AgentIntegrations from "./pages/AgentIntegrations";
import Download from "./pages/Download";

function GlobalCallOverlay() {
  const { user } = useAuthForCall();
  if (!user) return null;
  return <IncomingCallDialog />;
}


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <MultiAccountProvider>
        <PushNotificationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OnboardingSuggestions />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/search" element={<Explore />} />
              <Route path="/create" element={<Create />} />
              <Route path="/create/reel" element={<CreateReel />} />
              <Route path="/reels" element={<Reels />} />
              <Route path="/reels/:reelId" element={<Reels />} />
              <Route path="/post/:postId" element={<Post />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/profile/:username/followers" element={<Followers />} />
              <Route path="/profile/:username/following" element={<Following />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:conversationId" element={<Conversation />} />
              <Route path="/call/:callId" element={<Call />} />
              <Route path="/meet/:roomId" element={<Meet />} />
              <Route path="/creator" element={<Creator />} />
              <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/account" replace />} />
                <Route path="account" element={<AccountPage />} />
                <Route path="security" element={<SecurityPage />} />
                <Route path="2fa" element={<TwoFactorPage />} />

                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="appearance" element={<AppearancePage />} />
                <Route path="more" element={<Settings />} />
                <Route path="agent-integrations" element={<AgentIntegrations />} />
                <Route path="admin" element={<AdminPage />} />
              </Route>
              <Route path="/account-center" element={<AccountCenter />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/download" element={<Download />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <GlobalCallOverlay />
          </BrowserRouter>
        </TooltipProvider>
        </PushNotificationProvider>
      </MultiAccountProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
