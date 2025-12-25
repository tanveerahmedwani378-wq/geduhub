import React, { useRef, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '@/contexts/ChatContext';
import { Attachment, Message } from '@/types/chat';
import { toast } from 'sonner';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export const ChatArea: React.FC = () => {
  const { currentConversation, addMessage, userProfile, createConversation } = useChat();
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages, streamingContent]);

  const handleSend = async (content: string, attachments?: Attachment[]) => {
    if (!currentConversation) {
      createConversation();
    }

    // Add user message
    addMessage({
      role: 'user',
      content,
      attachments,
    });

    setIsLoading(true);
    setStreamingContent('');

    try {
      // Prepare messages for API
      const messages = [
        ...(currentConversation?.messages || []).map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content },
      ];

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              fullResponse += deltaContent;
              setStreamingContent(fullResponse);
            }
          } catch {
            // Partial JSON, continue
          }
        }
      }

      // Add the complete assistant message
      if (fullResponse) {
        addMessage({
          role: 'assistant',
          content: fullResponse,
        });
      }
      setStreamingContent('');
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get AI response');
      setStreamingContent('');
    } finally {
      setIsLoading(false);
    }
  };

  const needsPremium = !userProfile.isPremium && userProfile.messagesUsed >= userProfile.maxFreeMessages;

  // Create a temporary streaming message for display
  const displayMessages = currentConversation?.messages || [];
  const streamingMessage: Message | null = streamingContent ? {
    id: 'streaming',
    role: 'assistant',
    content: streamingContent,
    timestamp: new Date(),
  } : null;

  if (!currentConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 glow-primary animate-float">
          <Sparkles className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-semibold text-foreground mb-2">
          Welcome to <span className="gradient-text">GEDUHub</span>
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
        {displayMessages.map(message => (
          <ChatMessage key={message.id} message={message} />
        ))}
        
        {streamingMessage && (
          <ChatMessage key="streaming" message={streamingMessage} />
        )}

        {isLoading && !streamingContent && (
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

      <ChatInput onSend={handleSend} disabled={needsPremium} isLoading={isLoading} />
    </div>
  );
};
