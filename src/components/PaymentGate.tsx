import React, { useState } from 'react';
import { Crown, Zap, MessageSquare, FileText, Mic, Shield, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/ChatContext';
import { toast } from 'sonner';

export const PaymentGate: React.FC = () => {
  const { setPremium, userProfile } = useChat();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = () => {
    setIsProcessing(true);
    toast.info('Connecting to Razorpay...');
    
    // Simulate payment process
    setTimeout(() => {
      setPremium(true);
      setIsProcessing(false);
      toast.success('🎉 Payment successful! Welcome to Premium!');
    }, 2500);
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
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 glow-primary animate-float">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              You've reached your free limit
            </h2>
            <p className="text-muted-foreground">
              Upgrade to Premium for unlimited access
            </p>
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

          {/* CTA Button */}
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
                Upgrade with Razorpay
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            🔒 Secure payment • Cancel anytime • Instant activation
          </p>
        </div>
      </div>
    </div>
  );
};
