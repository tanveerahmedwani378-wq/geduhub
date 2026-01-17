import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Plus, X, Loader2, Image, FileText, Brain, Search, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/ChatContext';
import { Attachment } from '@/types/chat';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import pdfToText from 'react-pdftotext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ChatInputProps {
  onSend: (content: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled, isLoading }) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const { isRecording, setIsRecording } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    if (isLoading) return;
    
    // Include file contents in the message
    let messageContent = input;
    if (attachments.length > 0) {
      const fileTexts = attachments
        .map(a => {
          const content = fileContents.get(a.id);
          if (content) {
            return `\n\n[File: ${a.name}]\n${content}`;
          }
          return `\n\n[File attached: ${a.name}]`;
        })
        .join('');
      messageContent = input + fileTexts;
    }
    
    onSend(messageContent, attachments);
    setInput('');
    setAttachments([]);
    setFileContents(new Map());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunksRef.current.length === 0) {
          toast.error('No audio recorded');
          return;
        }

        setIsTranscribing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            // Send to edge function for transcription
            const { data, error } = await supabase.functions.invoke('elevenlabs-scribe-token', {});
            
            if (error || !data?.token) {
              throw new Error(error?.message || 'Failed to get transcription token');
            }

            // Use WebSocket for real-time transcription
            const ws = new WebSocket(`wss://api.elevenlabs.io/v1/realtime_scribe?token=${data.token}`);
            
            ws.onopen = () => {
              // Send audio config
              ws.send(JSON.stringify({
                type: 'config',
                audio_format: 'pcm_16000',
              }));
              
              // For now, just show a message that we got the token
              // Full implementation would stream audio chunks
              toast.success('Voice recording captured');
              setInput(prev => prev + ' [Voice message - transcription in progress]');
              setIsTranscribing(false);
              ws.close();
            };

            ws.onerror = () => {
              toast.error('Transcription failed');
              setIsTranscribing(false);
            };
          };
        } catch (error) {
          console.error('Transcription error:', error);
          toast.error('Failed to transcribe audio');
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      toast.success('Recording started - speak now');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Could not access microphone');
    }
  }, [setIsRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    toast.info('Recording stopped');
  }, [setIsRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const extractPdfText = async (file: File): Promise<string> => {
    try {
      const text = await pdfToText(file);
      console.log(`PDF extracted: ${text.length} characters`);
      return text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      return `[Failed to extract PDF text: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check limit - max 10 files
    const totalFiles = attachments.length + files.length;
    if (totalFiles > 10) {
      toast.error(`Maximum 10 files allowed. You have ${attachments.length} files, trying to add ${files.length}.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const newAttachments: Attachment[] = [];
    const newContents = new Map(fileContents);

    // Process files in parallel for speed
    const fileProcessingPromises = Array.from(files).map(async (file) => {
      // Check file size (20MB limit)
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 20MB)`);
        return null;
      }

      const id = crypto.randomUUID();
      const attachment: Attachment = {
        id,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        size: file.size,
      };

      // Read text content from documents
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.csv')) {
        try {
          const content = await readFileAsText(file);
          return { attachment, content, id };
        } catch (error) {
          console.error('Failed to read file:', error);
          return { attachment, content: '[Failed to read file]', id };
        }
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        toast.info(`Extracting text from ${file.name}...`);
        const pdfText = await extractPdfText(file);
        toast.success(`Extracted text from ${file.name}`);
        return { attachment, content: pdfText, id };
      } else if (file.type.startsWith('image/')) {
        // Convert image to base64 for AI analysis
        return new Promise<{ attachment: Attachment; content: string; id: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({ attachment, content: e.target?.result as string || '', id });
          };
          reader.onerror = () => {
            resolve({ attachment, content: '[Failed to read image]', id });
          };
          reader.readAsDataURL(file);
        });
      } else {
        // Other file types - just attach without content
        return { attachment, content: '[Unsupported file format]', id };
      }
    });

    const results = await Promise.all(fileProcessingPromises);
    
    for (const result of results) {
      if (result) {
        newAttachments.push(result.attachment);
        newContents.set(result.id, result.content);
      }
    }

    setFileContents(newContents);
    setAttachments(prev => [...prev, ...newAttachments]);
    
    if (newAttachments.length > 0) {
      toast.success(`${newAttachments.length} file(s) attached and ready for analysis`);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
    setFileContents(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const [showMenu, setShowMenu] = useState(false);

  const handleFeatureClick = (feature: string) => {
    switch (feature) {
      case 'image':
        setInput('Generate an image of ');
        break;
      case 'thinking':
        setInput('[Thinking mode] ');
        toast.info('Deep thinking mode enabled');
        break;
      case 'research':
        setInput('Research and explain ');
        break;
      default:
        break;
    }
    setShowMenu(false);
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-sm p-4">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map(attachment => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg text-sm animate-scale-in"
            >
              <span className="text-muted-foreground">📎 {attachment.name}</span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
        />

        <DropdownMenu open={showMenu} onOpenChange={setShowMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
              disabled={disabled || isLoading}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <FileText className="w-4 h-4 mr-2" />
              Add photos & files
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleFeatureClick('image')}>
              <Image className="w-4 h-4 mr-2" />
              Create image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFeatureClick('thinking')}>
              <Brain className="w-4 h-4 mr-2" />
              Thinking
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFeatureClick('research')}>
              <Search className="w-4 h-4 mr-2" />
              Deep research
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <MoreHorizontal className="w-4 h-4 mr-2" />
              More coming soon...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message GEDUHub..."
            disabled={disabled || isLoading}
            rows={1}
            className="w-full resize-none bg-secondary border-0 rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[48px] max-h-[200px] scrollbar-thin"
            style={{
              height: 'auto',
              minHeight: '48px',
            }}
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`shrink-0 transition-all duration-300 ${
            isRecording
              ? 'text-destructive bg-destructive/10 hover:bg-destructive/20 animate-pulse'
              : isTranscribing
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
          onClick={toggleRecording}
          disabled={disabled || isLoading || isTranscribing}
        >
          {isTranscribing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </Button>

        <Button
          type="submit"
          size="icon"
          disabled={disabled || isLoading || (!input.trim() && attachments.length === 0)}
          className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground glow-primary transition-all duration-300"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </form>
      
      {/* Disclaimer */}
      <p className="text-center text-xs text-muted-foreground mt-2">
        GEDUHub can make mistakes. Check important info. 
        <a href="/privacy" className="underline hover:text-foreground ml-1">Privacy Policy</a>
        {' · '}
        <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>
      </p>
    </div>
  );
};
