import React, { useState } from 'react';
import { ChatProvider, useChat } from '@/contexts/ChatContext';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { LibraryPage } from '@/components/pages/LibraryPage';
import { SettingsPage } from '@/components/pages/SettingsPage';
import { PaymentGate } from '@/components/PaymentGate';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'chat' | 'library' | 'settings'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { userProfile, selectConversation } = useChat();

  const showPaymentGate = !userProfile.isPremium && 
    userProfile.messagesUsed >= userProfile.maxFreeMessages;

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    setCurrentPage('chat');
  };

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

      {/* Payment Gate */}
      {showPaymentGate && <PaymentGate />}
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
