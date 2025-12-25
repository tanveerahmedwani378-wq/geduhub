import React from 'react';
import { MessageSquare, FileText, Calendar, Trash2, Search } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LibraryPageProps {
  onSelectConversation: (id: string) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({ onSelectConversation }) => {
  const { conversations, deleteConversation } = useChat();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Library</h1>
          <p className="text-muted-foreground">Browse and search your conversation history</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Chats', value: conversations.length, icon: MessageSquare },
            { label: 'Messages', value: conversations.reduce((acc, c) => acc + c.messages.length, 0), icon: FileText },
            { label: 'This Week', value: conversations.filter(c => {
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return c.createdAt > weekAgo;
            }).length, icon: Calendar },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-xl bg-secondary/50 border border-border">
              <stat.icon className="w-5 h-5 text-primary mb-2" />
              <div className="text-2xl font-semibold text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Conversations List */}
        <div className="space-y-3">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchQuery ? 'No results found' : 'No conversations yet'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Start a new chat to see it here'}
              </p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                className="p-4 rounded-xl bg-secondary/30 border border-border hover:border-primary/30 transition-all duration-300 cursor-pointer group"
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate mb-1 group-hover:text-primary transition-colors">
                      {conv.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.messages[conv.messages.length - 1]?.content || 'No messages'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {conv.updatedAt.toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {conv.messages.length} messages
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
