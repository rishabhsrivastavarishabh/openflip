import { Link } from 'react-router-dom';
import { Seo } from '@/components/seo/Seo';
import { PublicShell, Prose } from '@/components/marketing/PublicShell';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is Openflip?',
    a: 'Openflip is a social networking platform where you share photos and short vertical videos, post stories, message friends privately, follow creators and discover new content.',
  },
  {
    q: 'How do I create an Openflip account?',
    a: 'Open the sign-up form, enter your email address and a password, confirm your email using the sign-in link we send you, then complete the short setup wizard with your name, username and date of birth. You must be at least 13 years old.',
  },
  {
    q: 'How do I sign in?',
    a: 'Go to the sign-in page and use your email, username or mobile number with your password. You can also request an email sign-in link, and if you have two-factor authentication enabled you will be asked for your code.',
  },
  {
    q: 'Can I share posts on Openflip?',
    a: 'Yes. You can post single photos, carousels of up to five photos, reels, and stories that disappear after 24 hours. Posts can be cross-posted to your story and shared in direct messages.',
  },
  {
    q: 'Can I follow creators?',
    a: 'Yes. You can follow any public account, and send a follow request to private accounts. Creators can also offer paid fan subscriptions with exclusive content.',
  },
  {
    q: 'Is Openflip free?',
    a: 'Yes, creating an account and using the core features is free. Optional subscription plans and creator fan subscriptions are paid and billed in Indian rupees.',
  },
  {
    q: 'How do I make my account private?',
    a: 'Open Settings, then Privacy, and switch your account to private. Only approved followers can then see your posts, and you can separately control whether your profile is shown in search engines.',
  },
  {
    q: 'How can I delete my account?',
    a: 'Open Settings, then Account, and choose to delete your account. Deletion removes your profile and content from Openflip.',
  },
  {
    q: 'How does Openflip protect my privacy?',
    a: 'Direct messages are end-to-end encrypted between devices, private accounts restrict who can see your content, and you can block or report accounts at any time. The privacy policy explains what data is collected and how it is used.',
  },
  {
    q: 'Is there an Openflip app for Android?',
    a: 'Yes. You can download the Android app from the download page, and you can also install the website to your home screen on both mobile and desktop.',
  },
];

export default function Help() {
  return (
    <PublicShell>
      <Seo
        title="Openflip Help Centre — Frequently Asked Questions"
        description="Answers to common Openflip questions: creating an account, signing in, posting, following creators, pricing, privacy settings, deleting your account and getting the Android app."
        path="/help"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQ.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
      <Prose>
        <header>
          <h1 className="text-3xl font-bold">Help centre</h1>
          <p className="mt-3 text-muted-foreground">Frequently asked questions about using Openflip.</p>
        </header>
        <dl className="space-y-6">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">
                <h2 className="text-base font-semibold">{f.q}</h2>
              </dt>
              <dd className="text-muted-foreground mt-1">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          Still stuck? <Link to="/contact" className="underline underline-offset-4">Contact Openflip support</Link>.
        </p>
      </Prose>
    </PublicShell>
  );
}
