import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Seo } from '@/components/seo/Seo';
import { PublicShell, Prose } from '@/components/marketing/PublicShell';

const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || 'support@openflip.in';

export default function Contact() {
  return (
    <PublicShell>
      <Seo
        title="Contact Openflip — Support, Reports & Business Enquiries"
        description="Get in touch with the Openflip team for account help, safety reports, privacy questions, verification and business enquiries, or report content directly inside the app."
        path="/contact"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: 'Contact Openflip',
          url: 'https://www.openflip.in/contact',
        }}
      />
      <Prose>
        <header>
          <h1 className="text-3xl font-bold">Contact Openflip</h1>
          <p className="mt-3 text-muted-foreground">
            We read every message sent to our support address and reply as soon as we can.
          </p>
        </header>

        <section>
          <h2 className="text-xl font-semibold">Email support</h2>
          <p className="mt-2 text-muted-foreground">
            For account help, privacy questions, verification or business enquiries:
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-accent/50 transition-colors"
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            {SUPPORT_EMAIL}
          </a>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Reporting content or accounts</h2>
          <p className="mt-2 text-muted-foreground">
            The fastest way to report abuse is inside the app: open the menu on the post, reel, comment, story or
            profile and choose Report. See the{' '}
            <Link to="/community" className="underline underline-offset-4">community guidelines</Link> for what we act on.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Before you write</h2>
          <p className="mt-2 text-muted-foreground">
            Many questions are already answered in the{' '}
            <Link to="/help" className="underline underline-offset-4">help centre</Link>.
          </p>
        </section>
      </Prose>
    </PublicShell>
  );
}
