import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MultiAccountProvider } from "@/contexts/MultiAccountContext";
import { PushNotificationProvider } from "@/components/PushNotificationProvider";
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
import Reels from "./pages/Reels";
import Followers from "./pages/Followers";
import Following from "./pages/Following";
import Search from "./pages/Search";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import HowItWorks from "./pages/HowItWorks";
import { CreateReel } from "./components/reels/CreateReel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <MultiAccountProvider>
        <PushNotificationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Feed />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/search" element={<Search />} />
              <Route path="/create" element={<Create />} />
              <Route path="/create/reel" element={<CreateReel />} />
              <Route path="/reels" element={<Reels />} />
              <Route path="/post/:postId" element={<Post />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/profile/:userId/followers" element={<Followers />} />
              <Route path="/profile/:userId/following" element={<Following />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:conversationId" element={<Conversation />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </PushNotificationProvider>
      </MultiAccountProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
