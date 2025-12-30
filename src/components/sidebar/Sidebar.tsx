import React from 'react';
import {
  Plus,
  MessageSquare,
  Library,
  Settings,
  Trash2,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/ChatContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import geduhubLogo from '@/assets/geduhub-logo.png';

interface SidebarProps {
  currentPage: 'chat' | 'library' | 'settings';
  onPageChange: (page: 'chat' | 'library' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange }) => {
  const {
    conversations,
    currentConversation,
    createConversation,
    selectConversation,
    deleteConversation,
    userProfile,
  } = useChat();

  return (
    <div className="w-64 h-full bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <img src={geduhubLogo} alt="GEDUHub" className="w-10 h-10 rounded-xl" />
          <div>
            <h1 className="font-semibold text-foreground">GEDUHub</h1>
            <p className="text-xs text-muted-foreground">
              {userProfile.isPremium ? (
                <span className="flex items-center gap-1 text-primary">
                  <Crown className="w-3 h-3" /> Premium
                </span>
              ) : (
                <span>Free plan</span>
              )}
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            createConversation();
            onPageChange('chat');
          }}
          className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Navigation */}
      <div className="p-2 border-b border-sidebar-border">
        <NavButton
          icon={MessageSquare}
          label="Chat"
          active={currentPage === 'chat'}
          onClick={() => onPageChange('chat')}
        />
        <NavButton
          icon={Library}
          label="Library"
          active={currentPage === 'library'}
          onClick={() => onPageChange('library')}
        />
        <NavButton
          icon={Settings}
          label="Settings"
          active={currentPage === 'settings'}
          onClick={() => onPageChange('settings')}
        />
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                currentConversation?.id === conv.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
              }`}
              onClick={() => {
                selectConversation(conv.id);
                onPageChange('chat');
              }}
            >
              <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{conv.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                aria-label="Delete conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Premium Banner */}
      {!userProfile.isPremium && (
        <div className="p-3 m-2 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Go Premium</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Unlimited messages & features for just ₹149
          </p>
          <Button
            size="sm"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
            onClick={() => onPageChange('settings')}
          >
            Upgrade Now
          </Button>
        </div>
      )}
    </div>
  );
};

const NavButton: React.FC<{
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
      active
        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

