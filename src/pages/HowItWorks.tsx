import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Wifi, Bell, Lock, Check, CheckCheck, MessageSquare, Users, Key } from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-4">
        <Seo title="How messaging works — Openflip" description="Learn how Openflip's secure end‑to‑end encrypted messaging keeps your chats private." path="/how-it-works" />
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border py-3 -mx-4 px-4 mb-6">
          <div className="flex items-center gap-3">
            <Link to="/messages" aria-label="Back to messages">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="font-semibold text-lg">How Messaging Works</h1>
          </div>
        </header>

        <div className="space-y-6">
          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Secure Messaging
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <p>
                Our messaging system is designed with privacy and security in mind. 
                Messages are transmitted in real-time using WebSocket connections, 
                ensuring instant delivery while maintaining connection security.
              </p>
            </CardContent>
          </Card>

          {/* Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-green-500" />
                1. Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                When you open a conversation, a secure WebSocket connection is established:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Real-time bidirectional communication</li>
                <li>Automatic reconnection on network changes</li>
                <li>Connection status indicator (online/offline)</li>
                <li>Presence detection for active users</li>
              </ul>
            </CardContent>
          </Card>

          {/* Encryption */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-500" />
                2. End-to-End Encryption (Conceptual)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                For enhanced privacy, we support end-to-end encryption where:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Messages are encrypted locally before sending</li>
                <li>Server stores only ciphertext (encrypted data)</li>
                <li>Only participants with the shared key can decrypt</li>
                <li>Per-chat encryption keys for isolation</li>
              </ul>
              <div className="flex items-center gap-2 mt-4 p-3 bg-primary/10 rounded-lg">
                <Key className="w-5 h-5 text-primary" />
                <span className="text-sm">
                  Each conversation has a unique shared key generated when the chat starts.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Message Routing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" />
                3. Message Routing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Messages are routed securely through our infrastructure:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Server validates sender identity</li>
                <li>Messages stored with conversation-level access control</li>
                <li>Real-time delivery to online recipients</li>
                <li>Offline storage for later delivery</li>
              </ul>
            </CardContent>
          </Card>

          {/* Message Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCheck className="w-5 h-5 text-cyan-500" />
                4. Message Status (Ticks)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <p>
                Track your message delivery with status indicators:
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Sent</p>
                    <p className="text-sm">Message delivered to server</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    <CheckCheck className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Delivered</p>
                    <p className="text-sm">Message received by recipient's device</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                    <CheckCheck className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Read</p>
                    <p className="text-sm">Message opened and seen by recipient</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Push Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                5. Push Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Stay informed even when the app is in the background:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Browser notifications for new messages</li>
                <li>Customizable notification preferences</li>
                <li>Sound alerts (optional)</li>
                <li>Notification grouping by conversation</li>
              </ul>
            </CardContent>
          </Card>

          {/* Group Chats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                6. Group Chats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                Create group conversations with advanced features:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Add multiple participants</li>
                <li>Admin controls for group management</li>
                <li>Group name and avatar customization</li>
                <li>Leave and rejoin capabilities</li>
                <li>Disappearing messages option</li>
              </ul>
            </CardContent>
          </Card>

          {/* Security Tips */}
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Shield className="w-5 h-5" />
                Security Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-muted-foreground">
              <p>• Never share your account credentials</p>
              <p>• Report suspicious messages or users</p>
              <p>• Use strong, unique passwords</p>
              <p>• Enable two-factor authentication when available</p>
              <p>• Be cautious with links from unknown sources</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
