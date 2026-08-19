import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FromOpenMedia } from '@/components/common/FromOpenMedia';

const PRODUCT = [
  { to: '/explore', label: 'Explore' },
  { to: '/features', label: 'Features' },
  { to: '/creators', label: 'Creators' },
  { to: '/community', label: 'Community' },
  { to: '/download', label: 'Get the app' },
];

const COMPANY = [
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

const SUPPORT = [
  { to: '/help', label: 'Help & FAQ' },
  { to: '/how-it-works', label: 'How messaging works' },
];

const LEGAL = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 h-14">
        <Link to="/" className="font-bold text-lg bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
          Openflip
        </Link>
        <nav aria-label="Primary" className="hidden md:flex items-center gap-4 ml-4 text-sm">
          {PRODUCT.slice(0, 4).map((l) => (
            <Link key={l.to} to={l.to} className="text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
          <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
          <Link to="/help" className="text-muted-foreground hover:text-foreground transition-colors">Help</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
          <Button asChild size="sm"><Link to="/auth?mode=signup">Create account</Link></Button>
        </div>
      </div>
    </header>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <p className="font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">Openflip</p>
            <p className="text-sm text-muted-foreground mt-1">Connect, share and discover.</p>
          </div>
          <FooterCol title="Product" links={PRODUCT} />
          <FooterCol title="Company" links={COMPANY} />
          <FooterCol title="Support" links={SUPPORT} />
          <FooterCol title="Legal" links={LEGAL} />
        </div>
        <FromOpenMedia />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Openflip. All rights reserved.</p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">{children}</div>;
}
