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

      const contentType = response.headers.get('content-type');
      
      // Check if it's an image response (JSON, not streaming)
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        
        if (data.type === 'image') {
          // Handle image generation response
          let messageContent = data.content || "Here's your generated image:";
          
          // Append images as markdown
          if (data.images && data.images.length > 0) {
            const imageMarkdown = data.images.map((url: string) => `\n\n![Generated Image](${url})`).join('');
            messageContent += imageMarkdown;
          }
          
          addMessage({
            role: 'assistant',
            content: messageContent,
            images: data.images,
          });
          setStreamingContent('');
          setIsLoading(false);
          return;
        }
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

  if (!currentConversation || displayMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <h1 className="text-4xl font-semibold text-foreground mb-12">
            What can I help with?
          </h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mb-8">
            {[
              { icon: '🖼️', title: 'Create image', desc: 'Generate AI images' },
              { icon: '💭', title: 'Thinking', desc: 'Deep reasoning mode' },
              { icon: '🔍', title: 'Research', desc: 'Find information' },
              { icon: '📝', title: 'Write', desc: 'Essays, emails, stories' },
            ].map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-secondary/50 border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group text-center"
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <h3 className="font-medium text-foreground group-hover:text-primary transition-colors text-sm">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <ChatInput onSend={handleSend} disabled={needsPremium} isLoading={isLoading} />
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
