import React, { useState } from 'react';
import { Copy, Check, Download, User, Sparkles, Pencil, X, RefreshCw, FileText, Presentation, Send } from 'lucide-react';
import { Message } from '@/types/chat';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useChat } from '@/contexts/ChatContext';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { generatePresentation } from '@/lib/presentationGenerator';

interface ChatMessageProps {
  message: Message;
  onRegenerate?: () => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRegenerate, onEditAndResend }) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const { updateMessage } = useChat();
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      // Split content into paragraphs
      const paragraphs = message.content.split('\n').map(line => 
        new Paragraph({
          children: [new TextRun({ text: line || ' ', size: 24 })],
          spacing: { after: 200 },
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `response-${message.id.slice(0, 8)}.docx`);
      toast.success('Downloaded as Word document');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download');
    }
  };

  const handleDownloadPPT = async () => {
    try {
      await generatePresentation(message.content, `presentation-${message.id.slice(0, 8)}`);
      toast.success('Downloaded as PowerPoint');
    } catch (error) {
      console.error('PPT download error:', error);
      toast.error('Failed to create presentation');
    }
  };

  const handleEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      updateMessage(message.id, editContent.trim());
      toast.success('Message updated');
    }
    setIsEditing(false);
  };

  const handleEditAndResend = () => {
    if (editContent.trim() && onEditAndResend) {
      onEditAndResend(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  return (
    <div
      className={`flex gap-3 sm:gap-4 p-3 sm:p-4 animate-fade-in mx-1 sm:mx-2 my-1 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-primary to-accent glow-primary">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-foreground" />
        </div>
      )}

      <div className={`space-y-2 min-w-0 ${isUser ? 'max-w-[70%]' : 'flex-1 max-w-[85%]'}`}>
        {!isUser && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">GEDUHub</span>
            <span className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
            />
            <div className="flex gap-2 flex-wrap">
              {onEditAndResend && (
                <Button size="sm" onClick={handleEditAndResend} className="h-8 bg-primary hover:bg-primary/90">
                  <Send className="w-4 h-4 mr-1" />
                  Resend
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={handleSaveEdit} className="h-8">
                Save only
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8">
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className={`leading-relaxed whitespace-pre-wrap break-words ${
            isUser ? 'bg-user-message text-foreground rounded-2xl px-4 py-2.5 inline-block' : 'text-foreground/90'
          }`}>
            {message.content.replace(/!\[Generated Image\]\([^)]+\)/g, '')}
          </div>
        )}

        {/* Display generated images */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {message.images.map((imageUrl, index) => (
              <div key={index} className="relative group">
                <img
                  src={imageUrl}
                  alt={`Generated image ${index + 1}`}
                  className="max-w-full sm:max-w-md rounded-lg border border-border shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => window.open(imageUrl, '_blank')}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    
                    try {
                      const response = await fetch(imageUrl);
                      const blob = await response.blob();
                      const file = new File([blob], `generated-image-${index + 1}.png`, { type: 'image/png' });
                      
                      // Use Web Share API on mobile if available (best for iOS/Android)
                      if (isMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
                        await navigator.share({
                          files: [file],
                          title: 'Generated Image',
                        });
                        toast.success('Image shared');
                        return;
                      }
                      
                      // Desktop: use blob download
                      if (!isMobile) {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `generated-image-${index + 1}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        toast.success('Image downloaded');
                        return;
                      }
                      
                      // Mobile fallback: open in new tab
                      window.open(imageUrl, '_blank');
                      toast.info('Long press the image to save');
                    } catch {
                      // Final fallback
                      window.open(imageUrl, '_blank');
                      toast.info('Long press the image to save');
                    }
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

        {/* Action buttons for both user and AI messages */}
        {!isEditing && (
          <div className="flex items-center gap-1 mt-2 sm:mt-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 sm:h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
              <span className="ml-1 sm:ml-1.5 text-xs">Copy</span>
            </Button>
            
            {isUser && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 sm:h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
                onClick={handleEdit}
              >
                <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-1.5 text-xs">Edit</span>
              </Button>
            )}
            
            {!isUser && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 sm:h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
                onClick={handleDownload}
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-1.5 text-xs">Word</span>
              </Button>
            )}

            {!isUser && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 sm:h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
                onClick={handleDownloadPPT}
              >
                <Presentation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-1.5 text-xs">PPT</span>
              </Button>
            )}
            
            {!isUser && onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 sm:h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
                onClick={onRegenerate}
              >
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-1.5 text-xs">Regenerate</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 bg-secondary">
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};
