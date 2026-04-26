import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, User, Shield, MessageCircleOff, ChevronRight, ChevronLeft } from 'lucide-react';
import { lobbyService } from '../../services/lobbyService';
import { ChatMessage } from '../../types';
import { cn } from '../../lib/utils';

interface ChatProps {
  lobbyId: string;
  guestId: string;
  nickname: string;
  isCaptain1: boolean;
  isCaptain2: boolean;
  isAdmin: boolean;
  isSpectator: boolean;
  t: any;
}

export function Chat({ lobbyId, guestId, nickname, isCaptain1, isCaptain2, isAdmin, isSpectator, t }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = lobbyService.subscribeToMessages(lobbyId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [lobbyId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSpectator && !isAdmin) return;

    let senderRole: 'Host' | 'Guest' | 'ADMIN' | 'Spectator' = 'Spectator';
    if (isAdmin) senderRole = 'ADMIN';
    else if (isCaptain1) senderRole = 'Host';
    else if (isCaptain2) senderRole = 'Guest';

    try {
      await lobbyService.sendChatMessage(lobbyId, {
        lobbyId,
        senderId: guestId,
        senderName: nickname,
        senderRole,
        text: inputText.trim()
      });
      setInputText('');
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const getRoleTag = (role: string) => {
    switch (role) {
      case 'Host': return <span className="text-cyan-400 font-black mr-1">[Host]</span>;
      case 'Guest': return <span className="text-red-400 font-black mr-1">[Guest]</span>;
      case 'ADMIN': return <span className="text-amber-500 font-black mr-1">[ADMIN]</span>;
      default: return null;
    }
  };

  const canChat = isAdmin || isCaptain1 || isCaptain2;

  return (
    <div className="fixed right-0 bottom-24 z-40 flex items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 350 }}
            animate={{ x: 0 }}
            exit={{ x: 350 }}
            className="w-80 h-[500px] bg-slate-900/95 border-l border-y border-slate-800 rounded-l-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-100">{t.chat || 'LOBBY CHAT'}</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 opacity-30">
                  <MessageCircleOff className="w-8 h-8" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{t.noMessages || 'No messages yet'}</span>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] items-center flex">
                        {getRoleTag(msg.senderRole)}
                        <span className={cn(
                          "font-bold",
                          msg.senderId === guestId ? "text-slate-100" : "text-slate-400"
                        )}>
                          {msg.senderName}
                        </span>
                      </div>
                      <span className="text-[8px] text-slate-600 font-mono">
                        {msg.timestamp?.toDate ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 bg-slate-800/50 p-2 rounded-lg border border-slate-800/50 break-words">
                      {msg.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50">
              {canChat ? (
                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t.typeMessage || "Type message..."}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none transition-all"
                  />
                  <button
                    disabled={!inputText.trim()}
                    className="p-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:grayscale disabled:hover:bg-amber-500 text-slate-950 rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2 text-slate-500">
                  <Shield className="w-3 h-3" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">{t.spectatorsCannotChat || 'Spectators cannot chat'}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-12 h-12 flex items-center justify-center rounded-l-2xl border-l border-y transition-all relative group",
          isOpen 
            ? "bg-amber-500 border-amber-400 text-slate-950" 
            : "bg-slate-900/80 backdrop-blur-md border-slate-800 text-amber-500 hover:bg-slate-800"
        )}
      >
        <MessageSquare className="w-6 h-6" />
        {messages.length > 0 && !isOpen && (
          <div className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-950 shadow-lg scale-90">
            {messages.length > 9 ? '9+' : messages.length}
          </div>
        )}
      </button>
    </div>
  );
}
