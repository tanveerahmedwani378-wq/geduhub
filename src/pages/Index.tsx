import React, { useState, useEffect } from 'react';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { LibraryPage } from '@/components/pages/LibraryPage';
import { SettingsPage } from '@/components/pages/SettingsPage';
// Subscription system commented out - users can directly access the dashboard
// import { PaymentGate } from '@/components/PaymentGate';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
// import { supabase } from '@/integrations/supabase/client';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'chat' | 'library' | 'settings'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { selectConversation, setPremium } = useChat();

  // Subscription system commented out - grant premium access directly
  useEffect(() => {
    setPremium(true);
  }, [setPremium]);

  /*
  // --- Subscription check logic (commented out) ---
  const [isPaid, setIsPaid] = useState<boolean | null>(null); // null = loading
  const hasCheckedPayment = useRef(false);

  useEffect(() => {
    if (hasCheckedPayment.current) return;
    hasCheckedPayment.current = true;

    const checkPaymentStatus = async () => {
      const savedEmail = localStorage.getItem('geduhub_premium_email') || localStorage.getItem('geduhub_payment_email');
      
      if (savedEmail) {
        try {
          const { data, error } = await supabase.functions.invoke('check-subscription', {
            body: { email: savedEmail }
          });
          
          if (!error && data?.isPremium) {
            localStorage.setItem('geduhub_premium_email', savedEmail);
            setIsPaid(true);
            setPremium(true);
            return;
          }
        } catch (e) {
          console.error('Error checking subscription:', e);
        }
      }
      
      setIsPaid(false);
    };

    checkPaymentStatus();
  }, [setPremium]);

  const handlePaymentSuccess = () => {
    setIsPaid(true);
    setPremium(true);
  };
  // --- End subscription check logic ---
  */

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    setCurrentPage('chat');
  };

  /*
  // --- Subscription gate UI (commented out) ---
  // Show loading state while checking payment
  if (isPaid === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show payment gate if not paid
  if (!isPaid) {
    return <PaymentGate onClose={handlePaymentSuccess} />;
  }
  // --- End subscription gate UI ---
  */

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Sidebar */}
      <div
        className={`fixed lg:relative z-40 h-full transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {currentPage === 'chat' && <ChatArea />}
        {currentPage === 'library' && (
          <LibraryPage onSelectConversation={handleSelectConversation} />
        )}
        {currentPage === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
};

const Index: React.FC = () => {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  );
};

export default Index;
