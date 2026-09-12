import { Link } from 'react-router-dom';
import { Seo } from '@/components/seo/Seo';
import { PublicShell, Prose } from '@/components/marketing/PublicShell';

export default function About() {
  return (
    <PublicShell>
      <Seo
        title="About Openflip — What Openflip is and who it is for"
        description="Learn what Openflip is: a social networking platform for sharing photos and reels, messaging privately, following creators and building communities, and who it is built for."
        path="/about"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'About Openflip',
          url: 'https://www.openflip.in/about',
        }}
      />
      <Prose>
        <header>
          <h1 className="text-3xl font-bold">About Openflip</h1>
          <p className="mt-3 text-muted-foreground">
            Openflip is a social networking platform built by Open Media for sharing moments, staying in touch and
            discovering creators.
          </p>
        </header>

        <section>
          <h2 className="text-xl font-semibold">What is Openflip?</h2>
          <p className="mt-2 text-muted-foreground">
            Openflip is a social network where you create a profile, post photos and short vertical videos (reels),
            share stories that disappear after 24 hours, and talk to people through private chats, voice notes and
            calls. A feed and an explore page help you keep up with people you follow and find new content.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">What can you do on Openflip?</h2>
          <ul className="mt-2 space-y-2 text-muted-foreground list-disc pl-5">
            <li>Post photos, carousels of up to five images, and reels with captions and locations.</li>
            <li>Share stories, including close-friends-only stories and saved highlights.</li>
            <li>Message people one to one or in groups, with end-to-end encrypted text, voice notes and view-once media.</li>
            <li>Make voice and video calls.</li>
            <li>Follow people, comment, like and save posts, and collaborate on posts with other creators.</li>
            <li>Discover trending posts, reels, hashtags and people through explore and search.</li>
            <li>Use Openflip Studio for content management, analytics and monetisation if you have a creator or business account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Who is Openflip for?</h2>
          <p className="mt-2 text-muted-foreground">
            Openflip is for anyone aged 13 and above who wants to share what they are doing with friends, for creators
            building an audience around photos and short video, and for businesses that want a public presence with
            insights and promotion tools.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Privacy and safety</h2>
          <p className="mt-2 text-muted-foreground">
            Accounts can be public or private, direct messages are end-to-end encrypted between devices, and you can
            block or report accounts and content. See the{' '}
            <Link to="/privacy" className="underline underline-offset-4">privacy policy</Link> and{' '}
            <Link to="/terms" className="underline underline-offset-4">terms of service</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="mt-2 text-muted-foreground">
            Questions or problems? Visit the <Link to="/contact" className="underline underline-offset-4">contact page</Link>{' '}
            or read the <Link to="/help" className="underline underline-offset-4">help centre</Link>.
          </p>
        </section>
      </Prose>
    </PublicShell>
  );
}
