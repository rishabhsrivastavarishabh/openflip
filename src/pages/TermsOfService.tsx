import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function TermsOfServicePage() {
  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-4 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Terms of Service</h1>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Last updated: January 8, 2025
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using Openflip, you agree to be bound by these Terms of Service 
              and all applicable laws and regulations. If you do not agree with any of these terms, 
              you are prohibited from using this service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. User Accounts</h2>
            <p className="text-muted-foreground mb-2">
              When you create an account with us, you must:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Content</h2>
            <p className="text-muted-foreground mb-2">
              You retain ownership of content you post on Openflip. By posting content, you grant us 
              a non-exclusive, worldwide, royalty-free license to use, display, and distribute your 
              content in connection with our services. You agree not to post content that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Infringes on intellectual property rights</li>
              <li>Contains illegal, harmful, or offensive material</li>
              <li>Harasses, threatens, or discriminates against others</li>
              <li>Contains spam, malware, or deceptive content</li>
              <li>Violates any applicable laws or regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Prohibited Activities</h2>
            <p className="text-muted-foreground mb-2">
              You may not:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Use the service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the service</li>
              <li>Create multiple accounts or impersonate others</li>
              <li>Scrape, data mine, or extract data from our service</li>
              <li>Use bots or automated tools without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
            <p className="text-muted-foreground">
              The Openflip service, including its original content, features, and functionality, 
              is owned by Openflip and protected by international copyright, trademark, patent, 
              trade secret, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Termination</h2>
            <p className="text-muted-foreground">
              We may terminate or suspend your account immediately, without prior notice or liability, 
              for any reason, including without limitation if you breach the Terms. Upon termination, 
              your right to use the Service will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground">
              The service is provided "as is" and "as available" without any warranties of any kind, 
              either express or implied. We do not warrant that the service will be uninterrupted, 
              secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              In no event shall Openflip, its directors, employees, partners, or suppliers be liable 
              for any indirect, incidental, special, consequential, or punitive damages, including 
              without limitation, loss of profits, data, or goodwill.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify or replace these Terms at any time. If a revision is 
              material, we will try to provide at least 30 days notice prior to any new terms taking effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms, please contact us at 
              legal@openflip.app
            </p>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
