import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Terms = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to GEDUHub
        </Link>

        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mb-8">Last updated: December 30, 2024</p>

        <div className="space-y-8 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using GEDUHub ("the Service"), you accept and agree to be bound by the terms 
              and provisions of this agreement. If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p>
              GEDUHub is an AI-powered educational assistant platform that provides users with intelligent 
              tutoring, learning resources, and educational support. The Service may include features such as 
              AI chat assistance, document analysis, and personalized learning recommendations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. User Accounts and Registration</h2>
            <p className="mb-2">
              To access certain features of the Service, you may be required to provide your email address 
              and complete a subscription purchase. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Subscription and Payments</h2>
            <p className="mb-2">
              GEDUHub offers subscription-based access to premium features. By subscribing:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>You agree to pay the subscription fee of ₹149</li>
              <li>Payments are processed securely through Razorpay</li>
              <li>Subscription provides access to all premium features</li>
              <li>Refund requests are handled on a case-by-case basis</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Acceptable Use</h2>
            <p className="mb-2">You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Transmit harmful, offensive, or inappropriate content</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Interfere with or disrupt the Service's operation</li>
              <li>Use the Service for any fraudulent or deceptive purposes</li>
              <li>Reverse engineer or attempt to extract source code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Intellectual Property</h2>
            <p>
              All content, features, and functionality of the Service, including but not limited to text, 
              graphics, logos, and software, are owned by GEDUHub and are protected by international 
              copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. AI-Generated Content</h2>
            <p>
              The Service uses artificial intelligence to generate responses and educational content. 
              While we strive for accuracy, AI-generated content may contain errors or inaccuracies. 
              Users should verify important information independently and not rely solely on AI responses 
              for critical decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Privacy</h2>
            <p>
              Your privacy is important to us. Please review our{' '}
              <Link to="/privacy" className="text-cyan-400 hover:text-cyan-300 underline">
                Privacy Policy
              </Link>{' '}
              to understand how we collect, use, and protect your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER 
              EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, 
              OR COMPLETELY SECURE. YOUR USE OF THE SERVICE IS AT YOUR OWN RISK.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, GEDUHUB SHALL NOT BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATING TO 
              YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Termination</h2>
            <p>
              We reserve the right to terminate or suspend your access to the Service at any time, 
              without prior notice, for conduct that we believe violates these Terms or is harmful to 
              other users, us, or third parties, or for any other reason at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. We will notify users of significant changes by 
              posting the new Terms on this page and updating the "Last updated" date. Your continued 
              use of the Service after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India, 
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">14. Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:{' '}
              <a 
                href="mailto:mayaiisEDUHub@gmail.com" 
                className="text-cyan-400 hover:text-cyan-300 underline"
              >
                mayaiisEDUHub@gmail.com
              </a>
              {' | '}
              <a 
                href="mailto:myaiiseduhub@gmail.com" 
                className="text-cyan-400 hover:text-cyan-300 underline"
              >
                myaiiseduhub@gmail.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-muted-foreground text-sm">
          <p>© 2024 GEDUHub. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
