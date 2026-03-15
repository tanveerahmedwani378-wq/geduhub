import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { lovable } from '@/integrations/lovable/index';
import geduhubLogo from '@/assets/geduhub-logo.png';

const Auth: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Magic link sent! Check your inbox and click the link.');
      setStep('sent');
    } catch {
      toast.error('Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('New magic link sent to your email!');
      }
    } catch {
      toast.error('Failed to resend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="fixed top-20 right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 left-20 w-56 h-56 bg-accent/5 rounded-full blur-3xl" />

      <div className="max-w-md w-full p-8 rounded-2xl bg-card border border-border shadow-2xl relative">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />

        <div className="relative">
          <div className="text-center mb-8">
            <img
              src={geduhubLogo}
              alt="GEDUHub"
              className="w-20 h-20 rounded-2xl mx-auto mb-4 glow-primary animate-float"
            />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {step === 'email' ? 'Welcome to GEDUHub AI' : 'Check Your Inbox'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {step === 'email'
                ? "Enter your email to get started. We'll send you a magic link."
                : `We sent a magic link to ${email}. Click it to sign in.`}
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendLink} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 py-6 text-base"
                  required
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6 text-lg glow-primary transition-all duration-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  <>
                    Send Magic Link
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Didn't receive it? Check your spam folder or try again.
              </p>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {loading ? 'Sending...' : 'Resend link'}
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-6">
            By continuing, you agree to our{' '}
            <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>
            {' & '}
            <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
