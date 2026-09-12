import { Link } from 'react-router-dom';
import { Seo } from '@/components/seo/Seo';
import { PublicShell, Prose } from '@/components/marketing/PublicShell';

const GROUPS = [
  {
    title: 'Sharing',
    items: [
      'Photo posts and carousels of up to five images, with a built-in editor for crops, filters and adjustments.',
      'Reels: full-screen short vertical videos with their own feed.',
      'Stories that disappear after 24 hours, with close-friends sharing and saved highlights.',
      'Captions, locations, hashtags and collaboration with co-authors.',
    ],
  },
  {
    title: 'Messaging and calls',
    items: [
      'One-to-one and group chats with end-to-end encrypted text.',
      'Voice notes, reactions, replies, disappearing and view-once media.',
      'Voice and video calls with HD audio.',
    ],
  },
  {
    title: 'Discovery',
    items: [
      'A personalised home feed mixing posts, reels and suggestions.',
      'Explore page with trending content and categorised search.',
      'Search for people, hashtags and posts.',
    ],
  },
  {
    title: 'Creators and business',
    items: [
      'Openflip Studio: content manager, drafts, content calendar and real-time analytics.',
      'Audience insights and an AI growth assistant.',
      'Fan subscriptions, tips, promotions and a brand marketplace.',
      'Verification requests for eligible accounts.',
    ],
  },
  {
    title: 'Privacy and control',
    items: [
      'Public or private accounts and follower approval.',
      'Control over whether your profile appears in search engines.',
      'Blocking, reporting, and granular notification settings.',
    ],
  },
];

export default function Features() {
  return (
    <PublicShell>
      <Seo
        title="Openflip Features — Posts, Reels, Stories, Chat & Studio"
        description="Explore Openflip features: photo posts and carousels, reels, stories, encrypted messaging, voice and video calls, discovery, and creator tools in Openflip Studio."
        path="/features"
      />
      <Prose>
        <header>
          <h1 className="text-3xl font-bold">Openflip features</h1>
          <p className="mt-3 text-muted-foreground">
            Everything Openflip supports today, grouped by what you want to do.
          </p>
        </header>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="text-xl font-semibold">{g.title}</h2>
            <ul className="mt-2 space-y-2 text-muted-foreground list-disc pl-5">
              {g.items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </section>
        ))}
        <p className="text-sm text-muted-foreground">
          Ready to try it? <Link to="/auth?mode=signup" className="underline underline-offset-4">Create your account</Link> or{' '}
          <Link to="/explore" className="underline underline-offset-4">explore Openflip</Link>.
        </p>
      </Prose>
    </PublicShell>
  );
}
