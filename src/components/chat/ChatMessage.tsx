import React, { useState } from 'react';
import { Copy, Check, Download, User, Sparkles } from 'lucide-react';
import { Message } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([message.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response-${message.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded successfully');
  };

  return (
    <div
      className={`flex gap-4 p-4 animate-fade-in ${
        isUser ? 'bg-transparent' : 'bg-ai-bubble/50'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isUser
            ? 'bg-secondary'
            : 'bg-gradient-to-br from-primary to-accent glow-primary'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {isUser ? 'You' : 'GEDUHub'}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {message.content.replace(/!\[Generated Image\]\([^)]+\)/g, '')}
        </div>

        {/* Display generated images */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {message.images.map((imageUrl, index) => (
              <div key={index} className="relative group">
                <img
                  src={imageUrl}
                  alt={`Generated image ${index + 1}`}
                  className="max-w-md rounded-lg border border-border shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => window.open(imageUrl, '_blank')}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    const link = document.createElement('a');
                    link.href = imageUrl;
                    link.download = `generated-image-${index + 1}.png`;
                    link.click();
                    toast.success('Image downloaded');
                  }}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.attachments.map(attachment => (
              <div
                key={attachment.id}
                className="px-3 py-1.5 bg-secondary rounded-md text-sm text-muted-foreground"
              >
                📎 {attachment.name}
              </div>
            ))}
          </div>
        )}

        {!isUser && (
          <div className="flex items-center gap-1 mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span className="ml-1.5 text-xs">Copy</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" />
              <span className="ml-1.5 text-xs">Download</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
