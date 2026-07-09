import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download as DownloadIcon, Smartphone, Shield, Zap, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FromOpenMedia } from '@/components/common/FromOpenMedia';

const APK_URL = 'https://rjo7t2wzjhoes6ar.public.blob.vercel-storage.com/Openflip.apk';
const PAGE_URL = 'https://www.openflip.in/download';

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function Download() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Download Openflip for Android — Free APK';
    setMeta('description', 'Download the Openflip Android app (APK). Chat, share reels, and connect on the go.');
    setMeta('og:title', 'Download Openflip for Android', 'property');
    setMeta('og:description', 'Get the Openflip Android APK.', 'property');
    setMeta('og:url', PAGE_URL, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('twitter:card', 'summary_large_image');

    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = PAGE_URL;

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: 'Openflip',
      operatingSystem: 'Android',
      applicationCategory: 'SocialNetworkingApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      downloadUrl: APK_URL,
      url: PAGE_URL,
    });
    document.head.appendChild(ld);

    return () => {
      document.title = prevTitle;
      document.head.removeChild(ld);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" aria-label="Back to home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-semibold text-lg">Download Openflip</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <section className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg">
            <Smartphone className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Openflip for Android</h2>
          <p className="text-muted-foreground text-sm">
            Install the official Openflip app on your Android device to chat, share reels, and stay connected on the go.
          </p>
        </section>

        <Button
          asChild
          size="lg"
          className="w-full h-14 text-base bg-gradient-to-r from-primary to-purple-600"
        >
          <a href={APK_URL} target="_blank" rel="noopener noreferrer">
            <DownloadIcon className="mr-2 h-5 w-5" />
            Download Android App
          </a>
        </Button>

        <div className="grid grid-cols-1 gap-3">
          <Card className="p-4 flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Faster than the web</p>
              <p className="text-xs text-muted-foreground">Optimized for mobile with native performance.</p>
            </div>
          </Card>
          <Card className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">End-to-end encrypted messages</p>
              <p className="text-xs text-muted-foreground">Your chats stay private on your device.</p>
            </div>
          </Card>
          <Card className="p-4 flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Push notifications</p>
              <p className="text-xs text-muted-foreground">Never miss a message, follow, or reel.</p>
            </div>
          </Card>
        </div>

        <section className="space-y-4">
          <h3 className="text-center font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            From Open Media — Our Other Apps and Products
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shrink-0">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Sarath</p>
                  <p className="text-xs text-muted-foreground">Quick, lightweight browsing.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <a href="https://sarath.openflip.in/" target="_blank" rel="noopener noreferrer">
                    <Globe className="h-4 w-4 mr-1" /> Web
                  </a>
                </Button>
                <Button asChild size="sm" className="w-full">
                  <a href="https://rjo7t2wzjhoes6ar.public.blob.vercel-storage.com/Sarath.apk" target="_blank" rel="noopener noreferrer" download>
                    <DownloadIcon className="h-4 w-4 mr-1" /> APK
                  </a>
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">OpenChat</p>
                  <p className="text-xs text-muted-foreground">Simple, secure messaging.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <a href="https://openchat.openflip.in/" target="_blank" rel="noopener noreferrer">
                    <Globe className="h-4 w-4 mr-1" /> Web
                  </a>
                </Button>
                <Button asChild size="sm" className="w-full">
                  <a href="https://rjo7t2wzjhoes6ar.public.blob.vercel-storage.com/OpenChat.apk" target="_blank" rel="noopener noreferrer" download>
                    <DownloadIcon className="h-4 w-4 mr-1" /> APK
                  </a>
                </Button>
              </div>
            </Card>
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center">
          The APK download opens in a new tab. On Android, allow "Install from unknown sources" for this browser to
          install the app.
        </p>
      </main>
    </div>
  );
}
