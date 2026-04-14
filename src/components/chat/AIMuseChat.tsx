import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Sparkles, 
  X, 
  Send, 
  User, 
  Bot, 
  Loader2, 
  ChevronDown,
  MessageCircle
} from 'lucide-react';
import { IOSButton } from '@/components/ui/IOSButton';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIMuseChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI Muse. I can help you with branding strategies, username ideas, and content hooks. What are we building today?",
      timestamp: new Date()
    }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke('profile-assistant', {
        body: { 
          niche: input, 
          userId: user?.id,
          tone: 'Creative and Viral',
          country: 'Global'
        }
      });

      if (error) throw error;

      let responseContent = "";
      if (data.success && data.data) {
        const d = data.data;
        responseContent = `I've analyzed your niche! Here's a strategy:\n\n` +
          `✨ **Usernames**: ${d.usernames.slice(0, 3).join(', ')}...\n\n` +
          `📝 **IG Bio**: ${d.instagramBios[0]}\n\n` +
          `🪝 **Hook Style**: ${d.hookStyles[0]}\n\n` +
          `Would you like to explore more specific details for these?`;
      } else {
        responseContent = "I processed your request but couldn't generate a specific strategy. Could you provide more details about your niche?";
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      toast({
        title: 'Assistant Error',
        description: 'Failed to get a response from the AI Muse.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-ios-lg z-50 transition-all duration-300",
          isOpen ? "bg-muted rotate-90" : "bg-primary hover:scale-110 active:scale-95"
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-foreground" />
        ) : (
          <Sparkles className="w-6 h-6 text-primary-foreground animate-pulse" />
        )}
      </button>

      {/* Chat Windows */}
      <div
        className={cn(
          "fixed bottom-24 right-6 w-80 sm:w-96 max-h-[70vh] flex flex-col bg-ios-blur backdrop-blur-md border border-white/20 rounded-3xl shadow-ios-2xl z-50 transition-all duration-300 origin-bottom-right",
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-10 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">AI Muse Assistant</h3>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-ios-green rounded-full animate-pulse" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Online</span>
              </div>
            </div>
          </div>
          <IOSButton variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-8 w-8 p-0 rounded-full">
            <ChevronDown className="w-4 h-4" />
          </IOSButton>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-[300px]"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex flex-col max-w-[85%]",
                m.role === 'user' ? "ml-auto items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                  m.role === 'user' 
                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                    : "bg-white/10 text-foreground rounded-tl-none border border-white/5"
                )}
              >
                {m.content.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? "mt-1.5" : ""}>{line}</p>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-2 max-w-[85%]">
              <div className="bg-white/10 text-foreground px-4 py-2.5 rounded-2xl rounded-tl-none border border-white/5">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your niche (e.g. Luxury Fitness)..."
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-50 disabled:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[9px] text-center text-muted-foreground mt-3 font-medium">
            AI Muse can make mistakes. Verify important info.
          </p>
        </div>
      </div>
    </>
  );
}
