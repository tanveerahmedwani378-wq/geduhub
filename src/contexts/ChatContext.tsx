import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Message, Conversation, UserProfile } from '@/types/chat';

const STORAGE_KEY = 'geduhub_conversations_v1';

const loadConversations = (): Conversation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((c: any) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      messages: (c.messages || []).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    }));
  } catch {
    return [];
  }
};

interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  userProfile: UserProfile;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  speakNextResponse: boolean;
  setSpeakNextResponse: (value: boolean) => void;
  thinkingMode: boolean;
  setThinkingMode: (value: boolean) => void;
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
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  const [isRecording, setIsRecording] = useState(false);
  const [speakNextResponse, setSpeakNextResponse] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    isPremium: true,
    messagesUsed: 0,
    maxFreeMessages: 999999,
  });

  const createConversation = () => {
    // If there's already an empty chat, reuse it instead of creating another
    const existingEmpty = conversations.find(c => c.messages.length === 0);
    if (existingEmpty) {
      setCurrentConversation(existingEmpty);
      return;
    }
    if (currentConversation && currentConversation.messages.length === 0) {
      return;
    }
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
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    setConversations(prev => {
      const activeId = currentConversation?.id;
      const active = activeId ? prev.find(c => c.id === activeId) : null;

      if (!active) {
        const newConversation: Conversation = {
          id: crypto.randomUUID(),
          title: message.role === 'user' ? `${message.content.slice(0, 30)}...` : 'New Chat',
          messages: [newMessage],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setCurrentConversation(newConversation);
        return [newConversation, ...prev];
      }

      const updated: Conversation = {
        ...active,
        messages: [...active.messages, newMessage],
        title:
          active.messages.length === 0 && message.role === 'user'
            ? `${message.content.slice(0, 30)}...`
            : active.title,
        updatedAt: new Date(),
      };
      setCurrentConversation(updated);
      return prev.map(c => (c.id === active.id ? updated : c));
    });

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
        speakNextResponse,
        setSpeakNextResponse,
        thinkingMode,
        setThinkingMode,
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
