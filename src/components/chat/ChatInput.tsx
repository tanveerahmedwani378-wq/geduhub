import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Plus, X, Loader2, Image, FileText, Brain, Search, MoreHorizontal, Camera, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/contexts/ChatContext';
import { Attachment } from '@/types/chat';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
  const { isRecording, setIsRecording, setSpeakNextResponse, thinkingMode, setThinkingMode } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
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
    // On mobile, always allow new lines (Enter key)
    // On desktop, Shift+Enter sends message, Enter creates new line
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (e.key === 'Enter') {
      if (isMobile) {
        // On mobile, Enter always creates new line - do nothing (default behavior)
        return;
      }
      
      // On desktop: Shift+Enter sends message
      if (e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
      // Regular Enter on desktop allows new line (default behavior)
    }
  };

  const startRecording = useCallback(async () => {
    const SpeechRecognition: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Voice input not supported in this browser. Try Chrome.');
      return;
    }

    try {
      // Request mic permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Microphone permission denied');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalText = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      setInput(finalText + interim);
    };

    recognition.onerror = (e: any) => {
      console.error('Speech recognition error:', e.error);
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast.error(`Voice error: ${e.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      const text = finalText.trim();
      if (text) {
        // Mark that the next AI response should be spoken aloud
        setSpeakNextResponse(true);
        // Auto-send
        onSend(text);
        setInput('');
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
      toast.success('Listening... speak now');
    } catch (err) {
      console.error('Failed to start recognition:', err);
      toast.error('Could not start voice input');
    }
  }, [setIsRecording, setSpeakNextResponse, onSend]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsRecording(false);
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
      console.log('Starting PDF extraction for:', file.name, 'Size:', file.size);
      
      // Use backend edge function for reliable PDF parsing
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('PDF parse API error:', errorData);
        return `[Failed to extract PDF text: ${errorData.error || 'Server error'}]`;
      }
      
      const data = await response.json();
      
      if (!data.text || data.text.trim().length === 0) {
        console.warn('PDF extraction returned empty text');
        return '[The PDF appears to be empty or contains only images/scanned content. Please copy and paste the text manually.]';
      }
      
      console.log(`PDF extracted successfully: ${data.pages} pages, ${data.text.length} characters`);
      return data.text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      return `[Failed to extract PDF text. Please copy and paste the text manually. Error: ${error instanceof Error ? error.message : 'Unknown error'}]`;
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
        
        // Check if extraction was successful
        if (pdfText.startsWith('[Failed') || pdfText.startsWith('[The PDF') || pdfText.startsWith('[PDF extraction')) {
          toast.warning(`Could not fully extract text from ${file.name}`);
        } else {
          toast.success(`Extracted ${pdfText.length} characters from ${file.name}`);
        }
        
        return { attachment, content: pdfText, id };
      } else if (file.type.startsWith('image/')) {
        // Use vision API to extract text from images
        toast.info(`Extracting text from ${file.name}...`);
        try {
          const formData = new FormData();
          formData.append('file', file);
          
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-pdf`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: formData,
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.text && data.text.trim().length > 0) {
              toast.success(`Extracted text from ${file.name}`);
              return { attachment, content: data.text, id };
            }
          }
          toast.warning(`Could not extract text from ${file.name}`);
          return { attachment, content: '[Could not extract readable text from this image]', id };
        } catch (error) {
          console.error('Image text extraction error:', error);
          return { attachment, content: '[Failed to extract text from image]', id };
        }
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
      // 'video' case removed — video generation disabled
      case 'analyze':
        setInput('Analyze this image and describe what you see: ');
        toast.info('Attach an image to analyze');
        break;
      case 'thinking':
        setInput('[Thinking mode] ');
        toast.info('Deep thinking mode enabled');
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
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
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
            <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
              <Camera className="w-4 h-4 mr-2" />
              Take photo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <FileText className="w-4 h-4 mr-2" />
              Add photos & files
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleFeatureClick('image')}>
              <Image className="w-4 h-4 mr-2" />
              Create image
            </DropdownMenuItem>
            {/* Video creation disabled to preserve AI credits */}
            <DropdownMenuItem onClick={() => handleFeatureClick('analyze')}>
              <Search className="w-4 h-4 mr-2" />
              Analyze image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFeatureClick('thinking')}>
              <Brain className="w-4 h-4 mr-2" />
              Thinking
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
      
      {/* Send hint + Disclaimer */}
      <p className="text-center text-xs text-muted-foreground mt-2">
        <span className="hidden sm:inline">Shift+Enter to send · </span>
        GEDUHub can make mistakes. Check important info. 
        <a href="/privacy" className="underline hover:text-foreground ml-1">Privacy Policy</a>
        {' · '}
        <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>
        {' · '}
        <a href="mailto:myaiiseduhub@gmail.com" className="underline hover:text-foreground">myaiiseduhub@gmail.com</a>
      </p>
    </div>
  );
};
