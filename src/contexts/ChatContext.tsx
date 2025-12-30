import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Message, Conversation, UserProfile } from '@/types/chat';

interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  userProfile: UserProfile;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  createConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  setPremium: (value: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    isPremium: true, // No free message limit - all users have full access
    messagesUsed: 0,
    maxFreeMessages: 999999, // Effectively unlimited
  });

  const createConversation = () => {
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversation(newConversation);
  };

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    if (!currentConversation) {
      createConversation();
    }

    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    setConversations(prev =>
      prev.map(conv =>
        conv.id === currentConversation?.id
          ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              title: conv.messages.length === 0 && message.role === 'user' 
                ? message.content.slice(0, 30) + '...' 
                : conv.title,
              updatedAt: new Date(),
            }
          : conv
      )
    );

    setCurrentConversation(prev =>
      prev
        ? {
            ...prev,
            messages: [...prev.messages, newMessage],
            title: prev.messages.length === 0 && message.role === 'user' 
              ? message.content.slice(0, 30) + '...' 
              : prev.title,
            updatedAt: new Date(),
          }
        : null
    );

    if (message.role === 'user') {
      setUserProfile(prev => ({
        ...prev,
        messagesUsed: prev.messagesUsed + 1,
      }));
    }
  };

  const selectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) setCurrentConversation(conv);
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
    }
  };

  const setPremium = (value: boolean) => {
    setUserProfile(prev => ({ ...prev, isPremium: value }));
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        currentConversation,
        userProfile,
        isRecording,
        setIsRecording,
        addMessage,
        createConversation,
        selectConversation,
        deleteConversation,
        setPremium,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
