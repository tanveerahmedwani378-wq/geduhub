import React, { useRef, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '@/contexts/ChatContext';
import { Attachment, Message } from '@/types/chat';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import geduhubChatLogo from '@/assets/geduhub-chat-logo.png';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export const ChatArea: React.FC = () => {
  const { currentConversation, addMessage, userProfile, createConversation, removeLastAssistantMessage } = useChat();
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
      // Prepare messages for API - validate before sending
      const messages = [
        ...(currentConversation?.messages || []).map(m => ({
          role: m.role,
          content: m.content.slice(0, 8000), // Enforce client-side limit
        })),
        { role: 'user', content: content.slice(0, 8000) },
      ].slice(-50); // Limit message history

      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific error codes
        if (response.status === 402) {
          toast.error('Free message limit reached. Please upgrade to premium for unlimited access.');
          return;
        }
        if (response.status === 429) {
          toast.error('Rate limit reached. Please wait a moment before trying again.');
          return;
        }
        
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

  const handleRegenerate = async () => {
    const lastUserMessage = removeLastAssistantMessage();
    if (lastUserMessage) {
      // Re-send the last user message to get a new response
      await handleSendForRegenerate(lastUserMessage.content, lastUserMessage.attachments);
    }
  };

  const handleSendForRegenerate = async (content: string, attachments?: Attachment[]) => {
    setIsLoading(true);
    setStreamingContent('');

    try {
      // Get messages after removing the last assistant message
      const messages = [
        ...(currentConversation?.messages || []).map(m => ({
          role: m.role,
          content: m.content.slice(0, 8000),
        })),
      ].slice(-50);

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 402) {
          toast.error('Free message limit reached. Please upgrade to premium for unlimited access.');
          return;
        }
        if (response.status === 429) {
          toast.error('Rate limit reached. Please wait a moment before trying again.');
          return;
        }
        throw new Error(errorData.error || 'Failed to get response');
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.type === 'image') {
          let messageContent = data.content || "Here's your generated image:";
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

      if (fullResponse) {
        addMessage({
          role: 'assistant',
          content: fullResponse,
        });
      }
      setStreamingContent('');
    } catch (error) {
      console.error('Regenerate error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate response');
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
      <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-background via-background to-secondary/20">
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          {/* Mobile: Minimal centered logo and greeting */}
          <div className="mb-4 md:mb-6">
            <img src={geduhubChatLogo} alt="GEDUHub" className="w-16 h-16 md:w-24 md:h-24 rounded-2xl shadow-lg shadow-primary/25" />
          </div>
          <h1 className="text-2xl md:text-5xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent mb-2 md:mb-4 text-center">
            What can I help with?
          </h1>
          <p className="text-muted-foreground text-sm md:text-lg mb-6 md:mb-12 max-w-md text-center hidden md:block">
            Ask me anything — from writing and research to creating images and deep thinking.
          </p>
          {/* Feature cards - only show on desktop */}
          <div className="hidden md:grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mb-8">
            {[
              { icon: '🎨', title: 'Create image', desc: 'Generate AI art', gradient: 'from-pink-500/20 to-rose-500/20', border: 'hover:border-pink-400/50' },
              { icon: '🧠', title: 'Thinking', desc: 'Deep reasoning', gradient: 'from-purple-500/20 to-violet-500/20', border: 'hover:border-purple-400/50' },
              { icon: '🔎', title: 'Research', desc: 'Find insights', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'hover:border-blue-400/50' },
              { icon: '✍️', title: 'Write', desc: 'Essays & stories', gradient: 'from-emerald-500/20 to-teal-500/20', border: 'hover:border-emerald-400/50' },
            ].map((item, i) => (
              <div
                key={i}
                className={`p-5 rounded-2xl bg-gradient-to-br ${item.gradient} backdrop-blur-sm border border-border/50 ${item.border} transition-all duration-300 cursor-pointer group text-center hover:scale-105 hover:shadow-lg`}
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
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
        {displayMessages.map((message, index) => (
          <ChatMessage 
            key={message.id} 
            message={message} 
            onRegenerate={message.role === 'assistant' && index === displayMessages.length - 1 && !isLoading ? handleRegenerate : undefined}
          />
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
