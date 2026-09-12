import { Link } from 'react-router-dom';
import { Seo } from '@/components/seo/Seo';
import { PublicShell, Prose } from '@/components/marketing/PublicShell';

export default function Creators() {
  return (
    <PublicShell>
      <Seo
        title="Openflip for Creators — Studio, Insights & Monetisation"
        description="Openflip gives creators a studio with content management, real-time analytics, audience insights, fan subscriptions, tips, promotions and a brand marketplace for paid deals."
        path="/creators"
      />
      <Prose>
        <header>
          <h1 className="text-3xl font-bold">Openflip for creators</h1>
          <p className="mt-3 text-muted-foreground">
            Switch your account to a creator or business account to unlock Openflip Studio, the workspace for managing
            content, understanding your audience and earning from your work.
          </p>
        </header>

        <section>
          <h2 className="text-xl font-semibold">Manage your content</h2>
          <p className="mt-2 text-muted-foreground">
            Studio brings posts, reels, stories and drafts into one place, with a content calendar for planning what
            goes out and when.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Understand your audience</h2>
          <p className="mt-2 text-muted-foreground">
            Real-time analytics cover views, reach and engagement, while audience insights show who follows you and how
            your following grows. An AI growth assistant suggests what to try next.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Earn from your work</h2>
          <ul className="mt-2 space-y-2 text-muted-foreground list-disc pl-5">
            <li>Fan subscriptions with your own tiers, pricing and benefits.</li>
            <li>Tips from your audience.</li>
            <li>Boost campaigns to promote a specific post or reel.</li>
            <li>A brand marketplace for paid brand deals with in-app messaging.</li>
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">Payments are processed in Indian rupees.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Get started</h2>
          <p className="mt-2 text-muted-foreground">
            <Link to="/auth?mode=signup" className="underline underline-offset-4">Create an account</Link>, then switch
            your account type in settings to open Studio. See all{' '}
            <Link to="/features" className="underline underline-offset-4">Openflip features</Link>.
          </p>
        </section>
      </Prose>
    </PublicShell>
  );
}
