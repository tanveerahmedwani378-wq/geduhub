import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Message, Conversation, UserProfile } from '@/types/chat';

interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  userProfile: UserProfile;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (messageId: string, newContent: string) => void;
  editAndResend: (messageId: string, newContent: string) => string | null;
  removeLastAssistantMessage: () => Message | null;
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

  const updateMessage = (messageId: string, newContent: string) => {
    if (!currentConversation) return;

    setConversations(prev =>
      prev.map(conv =>
        conv.id === currentConversation.id
          ? {
              ...conv,
              messages: conv.messages.map(msg =>
                msg.id === messageId ? { ...msg, content: newContent } : msg
              ),
              updatedAt: new Date(),
            }
          : conv
      )
    );

    setCurrentConversation(prev =>
      prev
        ? {
            ...prev,
            messages: prev.messages.map(msg =>
              msg.id === messageId ? { ...msg, content: newContent } : msg
            ),
            updatedAt: new Date(),
          }
        : null
    );
  };

  const editAndResend = (messageId: string, newContent: string): string | null => {
    if (!currentConversation) return null;

    const messageIndex = currentConversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return null;

    // Keep messages up to and including the edited message, but update its content
    const updatedMessages = currentConversation.messages
      .slice(0, messageIndex + 1)
      .map(msg => msg.id === messageId ? { ...msg, content: newContent } : msg);

    setConversations(prev =>
      prev.map(conv =>
        conv.id === currentConversation.id
          ? { ...conv, messages: updatedMessages, updatedAt: new Date() }
          : conv
      )
    );

    setCurrentConversation(prev =>
      prev ? { ...prev, messages: updatedMessages, updatedAt: new Date() } : null
    );

    return newContent;
  };

  const removeLastAssistantMessage = (): Message | null => {
    if (!currentConversation) return null;
    
    const messages = currentConversation.messages;
    const lastMessage = messages[messages.length - 1];
    
    if (!lastMessage || lastMessage.role !== 'assistant') return null;
    
    const updatedMessages = messages.slice(0, -1);
    
    setConversations(prev =>
      prev.map(conv =>
        conv.id === currentConversation.id
          ? { ...conv, messages: updatedMessages, updatedAt: new Date() }
          : conv
      )
    );

    setCurrentConversation(prev =>
      prev ? { ...prev, messages: updatedMessages, updatedAt: new Date() } : null
    );
    
    // Return the last user message for regeneration
    const lastUserMessage = updatedMessages.filter(m => m.role === 'user').pop();
    return lastUserMessage || null;
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
        updateMessage,
        editAndResend,
        removeLastAssistantMessage,
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
