import { Link } from 'react-router-dom';
import { Camera, Film, MessageCircle, Users, Compass, ShieldCheck } from 'lucide-react';
import { Seo } from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { PublicShell } from '@/components/marketing/PublicShell';

const FEATURES = [
  { icon: Camera, title: 'Share moments', body: 'Post photos and carousels with captions, locations and built-in editing tools.' },
  { icon: Film, title: 'Reels', body: 'Create and watch full-screen short vertical videos in a dedicated reels feed.' },
  { icon: MessageCircle, title: 'Private messaging', body: 'One-to-one and group chats with end-to-end encrypted text, voice notes and calls.' },
  { icon: Compass, title: 'Explore', body: 'Find trending posts, reels, hashtags and people through search and discovery.' },
  { icon: Users, title: 'Creators & communities', body: 'Follow creators, collaborate on posts, and support them with fan subscriptions.' },
  { icon: ShieldCheck, title: 'Privacy controls', body: 'Private accounts, close-friends stories, blocking, reporting and search visibility settings.' },
];

const FAQ = [
  {
    q: 'What is Openflip?',
    a: 'Openflip is a social networking platform where you can share photos and short videos, message friends, follow creators and discover new content.',
  },
  {
    q: 'How do I create an Openflip account?',
    a: 'Open the sign-up form, enter your email and a password, verify your email through the link we send, then complete a short profile setup with your name, username and date of birth.',
  },
  {
    q: 'Is Openflip free to use?',
    a: 'Yes. Creating an account, posting, messaging and browsing are free. Optional paid plans and creator fan subscriptions are billed separately in Indian rupees.',
  },
  {
    q: 'Can I keep my account private?',
    a: 'Yes. You can switch your profile to private so only approved followers see your posts, and you can control whether your profile appears in search engines.',
  },
];

export default function Landing() {
  return (
    <PublicShell>
      <Seo
        title="Openflip — Connect, Share & Discover"
        description="Openflip is a social network where you can share moments, connect with friends, discover creators and build your community with photos, reels and encrypted messaging."
        path="/"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Openflip — Connect, Share & Discover',
            url: 'https://www.openflip.in/',
            description:
              'Openflip is a social network for sharing moments, connecting with friends, discovering creators and building your community.',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          },
        ]}
      />

      <section className="max-w-5xl mx-auto px-4 pt-14 pb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Openflip — <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">Connect, Share &amp; Discover</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Openflip is a social network where you can share moments, connect with friends, discover creators and build your community.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth?mode=signup">Create your account</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/explore">Explore Openflip</Link></Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Already have an account? <Link to="/auth" className="underline underline-offset-4">Sign in</Link>
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold">What is Openflip?</h2>
        <p className="mt-3 text-muted-foreground">
          Openflip is a social networking platform for photos, short videos and conversation. You create a profile, post
          photos or reels, follow the people and creators you care about, and keep in touch through private encrypted
          chats, voice notes and calls. A discovery feed and search help you find new posts, reels, hashtags and people.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold">What you can do on Openflip</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-xl border border-border bg-card p-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Icon className="w-4.5 h-4.5 text-primary" aria-hidden="true" />
              </div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{body}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          See the full list on the <Link to="/features" className="underline underline-offset-4">features page</Link>.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold">Privacy &amp; safety</h2>
        <p className="mt-3 text-muted-foreground">
          You choose who sees your content. Accounts can be public or private, stories can be limited to close friends,
          and direct messages are end-to-end encrypted between devices. You can block or report accounts and content at
          any time. Read the <Link to="/privacy" className="underline underline-offset-4">privacy policy</Link> and{' '}
          <Link to="/terms" className="underline underline-offset-4">terms of service</Link> for the details.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
        <dl className="mt-4 space-y-5">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="text-sm text-muted-foreground mt-1">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          More answers in the <Link to="/help" className="underline underline-offset-4">help centre</Link>.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-10 text-center">
        <h2 className="text-2xl font-semibold">Join Openflip</h2>
        <p className="mt-2 text-muted-foreground">Create a free account and start sharing in a couple of minutes.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth?mode=signup">Create your account</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/download">Get the Android app</Link></Button>
        </div>
      </section>
    </PublicShell>
  );
}
