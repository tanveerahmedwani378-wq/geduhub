import React, { useRef, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '@/contexts/ChatContext';
import { Attachment, Message } from '@/types/chat';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { create3DVideoFromImage } from '@/lib/video3d';
import geduhubChatLogo from '@/assets/geduhub-chat-logo.png';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface ChatAreaProps {
  initialMessage?: string | null;
  onInitialMessageConsumed?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ initialMessage, onInitialMessageConsumed }) => {
  const { currentConversation, addMessage, userProfile, createConversation, removeLastAssistantMessage, editAndResend, speakNextResponse, setSpeakNextResponse, thinkingMode } = useChat();
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialMessageSent = useRef(false);

  const speakText = (text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      // Strip markdown for cleaner speech
      const clean = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[#*_`>]/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .slice(0, 1000);
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = 'en-US';
      utter.rate = 1;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('TTS failed:', e);
    }
  };

  const addAssistantMessage = (content: string, images?: string[], videoUrl?: string) => {
    addMessage({
      role: 'assistant',
      content,
      images,
      videoUrl,
    });
    if (speakNextResponse) {
      setSpeakNextResponse(false);
      speakText(content);
    }
  };

  const parseJsonPayload = async (response: Response) => {
    const rawText = await response.text();

    if (!rawText.trim()) {
      return null;
    }

    try {
      return JSON.parse(rawText);
    } catch {
      return { content: rawText };
    }
  };

  const handleJsonChatPayload = async (response: Response, content: string) => {
    const data = await parseJsonPayload(response);

    if (!data) {
      return false;
    }

    if (typeof data.error === 'string' && !data.content) {
      addAssistantMessage(`⚠️ ${data.error}`);
      return true;
    }

    if (data.ok === false && typeof data.content === 'string') {
      addAssistantMessage(data.content, data.images, data.videoUrl);
      return true;
    }

    if (data.type === 'image') {
      let messageContent = data.content || "Here's your generated image:";

      if (data.images && data.images.length > 0) {
        const imageMarkdown = data.images.map((url: string) => `\n\n![Generated Image](${url})`).join('');
        messageContent += imageMarkdown;
      }

      addAssistantMessage(messageContent, data.images);
      return true;
    }

    if (data.type === 'video') {
      const imageUrl = data.images?.[0];

      if (imageUrl) {
        setStreamingContent('🎬 Composing your 3D video with sound... This takes ~15s.');

        try {
          const audio = await supabase.functions
            .invoke('video-audio', {
              body: { scene: content.slice(0, 400), duration: 6 },
            })
            .then((r) => r.data as { sfxUrl?: string; musicUrl?: string } | null)
            .catch((e) => {
              console.warn('Audio gen failed, video will be silent:', e);
              return null;
            });

          const videoBlob = await create3DVideoFromImage(imageUrl, {
            durationSec: 6,
            sfxUrl: audio?.sfxUrl ?? null,
            musicUrl: audio?.musicUrl ?? null,
          });
          const videoUrl = URL.createObjectURL(videoBlob);

          addAssistantMessage(
            `${data.content || "Here's your 3D video:"}\n\n🎬 Your 3D video with sound is ready! Click the button below to download it.`,
            data.images,
            videoUrl,
          );
        } catch (videoErr) {
          console.error('Video compilation error:', videoErr);
          addAssistantMessage(
            `${data.content || 'I generated the scene for your video:'}\n\n⚠️ Video compilation failed, but here\'s the scene image:`,
            data.images,
          );
        }

        return true;
      }

      addAssistantMessage(data.content || "Sorry, I couldn't generate the video scene. Please try again.");
      return true;
    }

    if (typeof data.content === 'string') {
      addAssistantMessage(data.content, data.images, data.videoUrl);
      return true;
    }

    return false;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleApiError = (status: number, errorMessage: string) => {
    if (status === 402) {
      toast.error('AI credits are unavailable right now. Please try again later.');
      addMessage({
        role: 'assistant',
        content: '⚠️ I can’t respond right now because the AI service is out of credits. Please try again later.',
      });
      return;
    }

    if (status === 429) {
      toast.error('Rate limit reached. Please wait a moment before trying again.');
      addMessage({
        role: 'assistant',
        content: '⚠️ I hit a rate limit while generating that. Please wait a moment and try again.',
      });
      return;
    }

    toast.error(errorMessage);
    addMessage({
      role: 'assistant',
      content: `⚠️ I couldn't complete that request: ${errorMessage}`,
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages, streamingContent]);

  // Auto-send initial message from skin care topic
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true;
      handleSend(initialMessage);
      onInitialMessageConsumed?.();
    }
  }, [initialMessage]);

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
        body: JSON.stringify({ messages, thinking: thinkingMode }),
      });

      if (!response.ok) {
        const errorData = await parseJsonPayload(response);
        const errorMessage = errorData?.error || 'Failed to get response';
        handleApiError(response.status, errorMessage);
        return;
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json') || contentType?.includes('text/plain')) {
        const handled = await handleJsonChatPayload(response, content);
        if (handled) {
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
        addAssistantMessage(fullResponse);
      } else {
        addAssistantMessage('⚠️ I could not generate a readable reply. Please try again.');
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

  const handleEditAndResend = async (messageId: string, newContent: string) => {
    const editedContent = editAndResend(messageId, newContent);
    if (editedContent) {
      // Send the edited message to get a new AI response
      await handleSendForEditedMessage(editedContent);
    }
  };

  const handleSendForEditedMessage = async (content: string) => {
    setIsLoading(true);
    setStreamingContent('');

    try {
      // Get current messages after edit (which removed subsequent messages)
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
        body: JSON.stringify({ messages, thinking: thinkingMode }),
      });

      if (!response.ok) {
        const errorData = await parseJsonPayload(response);
        const errorMessage = errorData?.error || 'Failed to get response';
        handleApiError(response.status, errorMessage);
        return;
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json') || contentType?.includes('text/plain')) {
        const handled = await handleJsonChatPayload(response, content);
        if (handled) {
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
        addAssistantMessage(fullResponse);
      } else {
        addAssistantMessage('⚠️ I could not generate a readable reply. Please try again.');
      }
      setStreamingContent('');
    } catch (error) {
      console.error('Edit and resend error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
      setStreamingContent('');
    } finally {
      setIsLoading(false);
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
        body: JSON.stringify({ messages, thinking: thinkingMode }),
      });

      if (!response.ok) {
        const errorData = await parseJsonPayload(response);
        const errorMessage = errorData?.error || 'Failed to get response';
        handleApiError(response.status, errorMessage);
        return;
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json') || contentType?.includes('text/plain')) {
        const handled = await handleJsonChatPayload(response, content);
        if (handled) {
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
        addAssistantMessage(fullResponse);
      } else {
        addAssistantMessage('⚠️ I could not generate a readable reply. Please try again.');
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
            Ready when you are.
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
            onEditAndResend={message.role === 'user' && !isLoading ? handleEditAndResend : undefined}
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
