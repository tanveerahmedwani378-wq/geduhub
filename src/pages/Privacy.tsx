import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Back Button */}
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to GEDUHub
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: December 30, 2024</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to GEDUHub AI ("we," "our," or "us"). We are committed to protecting your personal information 
              and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard 
              your information when you use our AI-powered educational assistant service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Email address (for account creation and subscription management)</li>
              <li>Payment information (processed securely through Razorpay)</li>
              <li>Chat conversations and queries you submit to our AI assistant</li>
              <li>Uploaded documents and files for analysis</li>
              <li>Usage data and interaction patterns with our service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide, maintain, and improve our AI educational services</li>
              <li>Process your transactions and manage your subscription</li>
              <li>Respond to your questions and provide customer support</li>
              <li>Send you technical notices and security alerts</li>
              <li>Analyze usage patterns to enhance user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal 
              information against unauthorized access, alteration, disclosure, or destruction. Your data is stored 
              on secure servers and we use encryption for data transmission. However, no method of transmission 
              over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may share your information with third-party service providers, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Razorpay:</strong> For secure payment processing</li>
              <li><strong>AI Model Providers:</strong> To process your queries and generate responses</li>
              <li><strong>Cloud Infrastructure:</strong> For hosting and data storage</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              These providers are contractually obligated to protect your information and use it only for the 
              purposes we specify.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Depending on your location, you may have certain rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access and receive a copy of your personal data</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as necessary to provide our services and fulfill 
              the purposes outlined in this policy. When you delete your account or request data deletion, we 
              will remove your personal information within 30 days, except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service is not intended for children under 13 years of age. We do not knowingly collect 
              personal information from children under 13. If we learn that we have collected personal 
              information from a child under 13, we will take steps to delete such information promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by 
              posting the new Privacy Policy on this page and updating the "Last updated" date. You are 
              advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>Email:</strong> mayaiisEDUHub@gmail.com | myaiiseduhub@gmail.com
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} GEDUHub AI. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
