import { Link } from 'react-router-dom';
import { Seo } from '@/components/seo/Seo';
import { PublicShell, Prose } from '@/components/marketing/PublicShell';

export default function Community() {
  return (
    <PublicShell>
      <Seo
        title="Openflip Community Guidelines — Safety, Respect & Reporting"
        description="Read the Openflip community guidelines: what belongs on Openflip, what is not allowed, how reporting and blocking work, and how to keep your account safe and private."
        path="/community"
      />
      <Prose>
        <header>
          <h1 className="text-3xl font-bold">Community guidelines</h1>
          <p className="mt-3 text-muted-foreground">
            Openflip works best when people feel safe sharing. These guidelines summarise what we expect; the full rules
            are in the <Link to="/terms" className="underline underline-offset-4">terms of service</Link>.
          </p>
        </header>

        <section>
          <h2 className="text-xl font-semibold">Be respectful</h2>
          <p className="mt-2 text-muted-foreground">
            Harassment, hate speech, threats and targeted abuse are not allowed. Disagree without attacking people.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Share what is yours</h2>
          <p className="mt-2 text-muted-foreground">
            Post content you created or have the right to share, and credit collaborators using the co-author feature.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Keep it lawful and age appropriate</h2>
          <p className="mt-2 text-muted-foreground">
            Openflip is for people aged 13 and above. Illegal content, sexual content involving minors, and content
            promoting self-harm or violence are removed and reported where required.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Reporting and blocking</h2>
          <p className="mt-2 text-muted-foreground">
            You can block an account or report a post, reel, comment, story or message from its menu. Reports go to the
            moderation team for review. Repeated violations can lead to content removal or account restrictions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Protecting your account</h2>
          <p className="mt-2 text-muted-foreground">
            Use a strong password, turn on two-factor authentication in security settings, and review your active
            devices. Read the <Link to="/privacy" className="underline underline-offset-4">privacy policy</Link> to see
            how your data is handled, or <Link to="/contact" className="underline underline-offset-4">contact us</Link>{' '}
            if something needs urgent attention.
          </p>
        </section>
      </Prose>
    </PublicShell>
  );
}
