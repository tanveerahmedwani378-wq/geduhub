import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '@/contexts/ChatContext';
import { Attachment } from '@/types/chat';

export const ChatArea: React.FC = () => {
  const { currentConversation, addMessage, userProfile, createConversation } = useChat();
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages]);

  const handleSend = async (content: string, attachments?: Attachment[]) => {
    if (!currentConversation) {
      createConversation();
    }

    addMessage({
      role: 'user',
      content,
      attachments,
    });

    // Simulate AI response
    setIsTyping(true);
    setTimeout(() => {
      const responses = [
        "I understand your question. Let me provide you with a comprehensive answer based on my knowledge.",
        "That's an interesting topic! Here's what I can tell you about it...",
        "Great question! I'd be happy to help you with that.",
        "Based on my analysis, here's what I think would be the best approach...",
        "Let me break this down for you step by step...",
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      addMessage({
        role: 'assistant',
        content: `${randomResponse}\n\nThis is a demo response. In production, this would connect to an AI model to generate real responses based on your query${attachments?.length ? ` and the ${attachments.length} attached file(s)` : ''}.`,
      });
      setIsTyping(false);
    }, 1500);
  };

  const needsPremium = !userProfile.isPremium && userProfile.messagesUsed >= userProfile.maxFreeMessages;

  if (!currentConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 glow-primary animate-float">
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Welcome to <span className="gradient-text">NexaAI</span>
        </h1>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Your intelligent AI assistant. Ask questions, upload documents, or use voice input to get started.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          {[
            { icon: '💬', title: 'Ask Anything', desc: 'Get instant answers to your questions' },
            { icon: '📄', title: 'Upload Files', desc: 'Analyze documents and images' },
            { icon: '🎤', title: 'Voice Input', desc: 'Speak naturally, get responses' },
          ].map((item, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-secondary/50 border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {currentConversation.messages.map(message => (
          <ChatMessage key={message.id} message={message} />
        ))}
        
        {isTyping && (
          <div className="flex gap-4 p-4 bg-ai-bubble/50 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary animate-typing" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-typing" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-typing" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={needsPremium} />
    </div>
  );
};
