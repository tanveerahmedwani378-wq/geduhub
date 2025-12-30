import React, { useState } from 'react';
import { Crown, Zap, MessageSquare, FileText, Mic, Shield, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@/contexts/ChatContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  const [step, setStep] = useState<'email' | 'payment'>('email');

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setStep('payment');
  };

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Failed to load payment gateway');
        setIsProcessing(false);
        return;
      }

      // Create order (via backend function)
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        { body: { email } }
      );

      if (orderError || !orderData?.orderId) {
        console.error('Create order error:', orderError);
        throw new Error(orderError?.message || 'Failed to create order');
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'GEDUHub',
        description: 'Premium Subscription - ₹149/month',
        order_id: orderData.orderId,
        prefill: { email },
        theme: { color: '#14b8a6' },
        handler: async (response: any) => {
          try {
            const { error: verifyError } = await supabase.functions.invoke('razorpay-webhook', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });

            if (!verifyError) {
              setPremium(true);
              localStorage.setItem('geduhub_premium_email', email);
              toast.success('🎉 Payment successful! Welcome to Premium!');
              onClose?.();
            } else {
              console.error('Verify error:', verifyError);
              toast.error('Payment verification failed. Please contact support.');
            }
          } catch (error) {
            console.error('Verification error:', error);
            toast.error('Payment verification failed');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info('Payment cancelled');
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to initiate payment. Please try again.');
      setIsProcessing(false);
    }
  };

  const features = [
    { icon: MessageSquare, text: 'Unlimited AI conversations' },
    { icon: FileText, text: 'Upload unlimited documents' },
    { icon: Mic, text: 'Voice input with Whisper' },
    { icon: Zap, text: '10x faster responses' },
    { icon: Shield, text: '24/7 priority support' },
  ];

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-2xl bg-card border border-border shadow-2xl animate-scale-in relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/10 rounded-full blur-2xl" />

        <div className="relative">
          {/* No close button - payment is required */}

          {/* Header */}
          <div className="text-center mb-8">
            <img src={geduhubLogo} alt="GEDUHub" className="w-20 h-20 rounded-2xl mx-auto mb-4 glow-primary animate-float" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to GEDUHub AI</h2>
            <p className="text-muted-foreground">Subscribe to unlock unlimited AI access</p>
          </div>

          {/* Price */}
          <div className="text-center mb-6">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-5xl font-bold gradient-text">₹149</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
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
            <Button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6 text-lg glow-primary transition-all duration-300"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Crown className="w-5 h-5 mr-2" />
                  Pay ₹149 with Razorpay
                </>
              )}
            </Button>
          )}

          <p className="text-center text-xs text-muted-foreground mt-4">🔒 Secure payment • Cancel anytime • Instant activation</p>
        </div>
      </div>
    </div>
  );
};

