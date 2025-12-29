import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Paperclip, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/ChatContext';
import { Attachment } from '@/types/chat';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const textParts: string[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        textParts.push(`[Page ${i}]\n${pageText}`);
      }
      
      return textParts.join('\n\n');
    } catch (error) {
      console.error('PDF extraction error:', error);
      return '[Failed to extract PDF text]';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    const newContents = new Map(fileContents);

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      const attachment: Attachment = {
        id,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        size: file.size,
      };
      newAttachments.push(attachment);

      // Read text content from documents
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        try {
          const content = await readFileAsText(file);
          newContents.set(id, content);
        } catch (error) {
          console.error('Failed to read file:', error);
        }
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        toast.info(`Extracting text from ${file.name}...`);
        const pdfText = await extractPdfText(file);
        newContents.set(id, pdfText);
        toast.success(`Extracted text from ${file.name}`);
      } else if (file.type.startsWith('image/')) {
        // Convert image to base64 for AI analysis
        const reader = new FileReader();
        reader.onload = (e) => {
          newContents.set(id, e.target?.result as string || '');
          setFileContents(new Map(newContents));
        };
        reader.readAsDataURL(file);
      }
    }

    setFileContents(newContents);
    setAttachments(prev => [...prev, ...newAttachments]);
    toast.success(`${files.length} file(s) attached`);
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

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading}
        >
          <Paperclip className="w-5 h-5" />
        </Button>

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
    </div>
  );
};
