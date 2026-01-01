import React, { useState, useEffect } from 'react';
import { Crown, Zap, MessageSquare, FileText, Mic, Clock, Loader2, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@/contexts/ChatContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import geduhubLogo from '@/assets/geduhub-logo.png';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentGateProps {
  onClose?: () => void;
}

export const PaymentGate: React.FC<PaymentGateProps> = ({ onClose }) => {
  const { setPremium } = useChat();
  const [isProcessing, setIsProcessing] = useState(false);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'payment' | 'verify'>('email');
  const [isVerifying, setIsVerifying] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [testMode, setTestMode] = useState(false);

  // Load Razorpay SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay SDK');
      toast.error('Failed to load payment system');
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setStep('payment');
  };

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      toast.error('Payment system is loading, please wait...');
      return;
    }

    setIsProcessing(true);
    const userEmail = email.trim().toLowerCase();
    
    // Store email before payment
    localStorage.setItem('geduhub_premium_email', userEmail);
    
    try {
      // Create order via edge function
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { email: userEmail, testMode }
      });

      if (error || !data?.orderId) {
        console.error('Order creation error:', error || data?.error);
        toast.error(data?.error || 'Failed to create order. Please try again.');
        setIsProcessing(false);
        return;
      }

      const orderId = data.orderId;

      // Open Razorpay checkout
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'GEDUHub AI',
        description: testMode ? 'Test Payment (₹1)' : '6 Months Premium Subscription',
        order_id: orderId,
        prefill: {
          email: userEmail,
        },
        theme: {
          color: '#6366f1'
        },
        handler: async function (response: any) {
          console.log('Payment response received:', response);
          toast.info('Verifying payment...');
          
          // Helper to activate premium
          const activatePremium = () => {
            console.log('Activating premium for:', userEmail);
            localStorage.setItem('geduhub_payment_email', userEmail);
            localStorage.setItem('geduhub_premium_email', userEmail);
            setPremium(true);
            toast.success('Payment successful! Welcome to GEDUHub Premium!');
            onClose?.();
            setIsProcessing(false);
          };

          // Helper to check subscription status
          const checkSubscription = async (): Promise<boolean> => {
            try {
              console.log('Checking subscription for:', userEmail);
              const { data, error } = await supabase.functions.invoke('check-subscription', {
                body: { email: userEmail }
              });
              console.log('Subscription check result:', data, 'Error:', error);
              return data?.isPremium === true;
            } catch (e) {
              console.error('Subscription check error:', e);
              return false;
            }
          };
          
          try {
            // Try to verify payment with webhook
            console.log('Calling razorpay-webhook for verification with payload:', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            
            const verifyRes = await supabase.functions.invoke('razorpay-webhook', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }
            });
            
            console.log('Webhook verification response:', verifyRes);
            
            if (verifyRes.data?.success) {
              activatePremium();
              return;
            }
            
            // Even if webhook didn't return success, check if DB was updated
            if (await checkSubscription()) {
              activatePremium();
              return;
            }
          } catch (err) {
            console.error('Webhook verification error:', err);
          }
          
          // Fallback: Wait a moment and check subscription status directly
          console.log('Fallback 1: Waiting 2s and checking subscription...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (await checkSubscription()) {
            activatePremium();
            return;
          }
          
          // Final fallback: Wait longer and try again
          console.log('Fallback 2: Waiting 3s more and checking again...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if (await checkSubscription()) {
            activatePremium();
            return;
          }
          
          // If all else fails, show manual verification option
          console.log('All verification attempts failed, showing manual option');
          setIsProcessing(false);
          toast.info('Payment received! Click "I already paid" to verify your subscription.');
        },
        modal: {
          ondismiss: function() {
            setIsProcessing(false);
            toast.info('Payment cancelled');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        toast.error(`Payment failed: ${response.error.description}`);
        setIsProcessing(false);
      });
      rzp.open();

    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Failed to initiate payment. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleVerifySubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        body: { email }
      });

      if (error) {
        toast.error('Failed to verify subscription. Please try again.');
        return;
      }

      if (data?.isPremium) {
        localStorage.setItem('geduhub_premium_email', email);
        setPremium(true);
        toast.success('Subscription verified! Welcome back!');
        onClose?.();
      } else {
        toast.error('No active subscription found for this email. Please check your email or complete payment.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      toast.error('Failed to verify subscription. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const features = [
    { icon: MessageSquare, text: 'Unlimited AI conversations' },
    { icon: FileText, text: 'Upload unlimited documents' },
    { icon: Mic, text: 'Voice input with Whisper' },
    { icon: Zap, text: '10x faster responses' },
    { icon: Clock, text: '24/7 priority support' },
  ];

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto overscroll-contain">
      <div className="min-h-full flex items-center justify-center py-6 px-4">
        <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-2xl animate-scale-in relative overflow-visible">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/10 rounded-full blur-2xl" />

        <div className="relative">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <img src={geduhubLogo} alt="GEDUHub" className="w-20 h-20 rounded-2xl mx-auto mb-4 glow-primary animate-float" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {step === 'verify' ? 'Verify Your Subscription' : 'Welcome to GEDUHub AI'}
            </h2>
            <p className="text-muted-foreground">
              {step === 'verify' ? 'Enter the email you used for payment' : 'Subscribe to unlock unlimited AI access'}
            </p>
          </div>

          {step === 'verify' ? (
            <form onSubmit={handleVerifySubscription} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your payment email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 py-6"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isVerifying}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6 text-lg glow-primary transition-all duration-300"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Verify Subscription
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
              >
                ← Back to payment options
              </button>
            </form>
          ) : (
            <>
              {/* Price */}
              <div className="text-center mb-4 sm:mb-6">
                <div className="inline-flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-bold gradient-text">₹149</span>
                  <span className="text-sm sm:text-base text-muted-foreground">/6 months</span>
                </div>
              </div>

              {/* Features - Hidden on very small screens */}
              <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8 max-h-[180px] sm:max-h-none overflow-y-auto">
                {features.map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 animate-slide-in-left"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <feature.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-foreground">{feature.text}</span>
                  </div>
                ))}
              </div>

              {step === 'email' ? (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 py-6"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6 text-lg glow-primary transition-all duration-300"
                  >
                    Continue to Payment
                  </Button>
                </form>
              ) : (
                <div className="space-y-3">
                  {/* Test mode toggle */}
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={testMode}
                      onChange={(e) => setTestMode(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    Test mode (₹1 payment)
                  </label>
                  
                  <Button
                    onClick={handlePayment}
                    disabled={isProcessing || !razorpayLoaded}
                    className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6 text-lg glow-primary transition-all duration-300"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : !razorpayLoaded ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Crown className="w-5 h-5 mr-2" />
                        Pay {testMode ? '₹1 (Test)' : '₹149'} with Razorpay
                      </>
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Change email
                  </button>
                </div>
              )}

              {/* I already paid button */}
              <div className="mt-6 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  className="w-full text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  I already paid → Verify my subscription
                </button>
              </div>

              <p className="text-center text-xs text-muted-foreground mt-4">🔒 Secure payment • Cancel anytime • Instant activation</p>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
