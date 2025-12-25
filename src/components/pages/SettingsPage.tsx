import React, { useState } from 'react';
import { 
  Crown, 
  Check, 
  Zap, 
  MessageSquare, 
  FileText, 
  Mic,
  Shield,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/ChatContext';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export const SettingsPage: React.FC = () => {
  const { userProfile, setPremium } = useChat();
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    saveHistory: true,
    voiceEnabled: true,
  });

  const handlePayment = () => {
    setIsProcessing(true);
    
    // Simulate Razorpay payment
    toast.info('Connecting to Razorpay...');
    
    setTimeout(() => {
      // Simulate successful payment
      setPremium(true);
      setIsProcessing(false);
      toast.success('🎉 Payment successful! Welcome to Premium!');
    }, 2000);
  };

  const features = [
    { icon: MessageSquare, text: 'Unlimited messages' },
    { icon: FileText, text: 'Unlimited document uploads' },
    { icon: Mic, text: 'Priority voice processing' },
    { icon: Zap, text: 'Faster response times' },
    { icon: Shield, text: 'Priority support' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your preferences and subscription</p>
        </div>

        {/* Subscription Card */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
                <Crown className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {userProfile.isPremium ? 'Premium Active' : 'Upgrade to Premium'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {userProfile.isPremium 
                    ? 'You have access to all features' 
                    : 'Unlock unlimited features'}
                </p>
              </div>
            </div>

            {!userProfile.isPremium && (
              <>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-foreground">₹149</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <div className="space-y-3 mb-6">
                  {features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-foreground">{feature.text}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium py-6 glow-primary"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 mr-2" />
                      Pay with Razorpay
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground mt-3">
                  Secure payment powered by Razorpay • Cancel anytime
                </p>
              </>
            )}

            {userProfile.isPremium && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 text-primary">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">All premium features unlocked!</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        <div className="mb-8 p-6 rounded-xl bg-secondary/30 border border-border">
          <h3 className="font-medium text-foreground mb-4">Usage Statistics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Messages Used</span>
                <span className="text-foreground">
                  {userProfile.isPremium 
                    ? 'Unlimited' 
                    : `${userProfile.messagesUsed} / ${userProfile.maxFreeMessages}`}
                </span>
              </div>
              {!userProfile.isPremium && (
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min((userProfile.messagesUsed / userProfile.maxFreeMessages) * 100, 100)}%` 
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="p-6 rounded-xl bg-secondary/30 border border-border">
          <h3 className="font-medium text-foreground mb-4">Preferences</h3>
          <div className="space-y-4">
            {[
              { key: 'notifications', label: 'Enable notifications', desc: 'Get notified about updates' },
              { key: 'saveHistory', label: 'Save chat history', desc: 'Keep your conversations saved' },
              { key: 'voiceEnabled', label: 'Voice input', desc: 'Enable microphone for voice input' },
            ].map((pref) => (
              <div key={pref.key} className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">{pref.label}</Label>
                  <p className="text-xs text-muted-foreground">{pref.desc}</p>
                </div>
                <Switch
                  checked={settings[pref.key as keyof typeof settings]}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, [pref.key]: checked }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
