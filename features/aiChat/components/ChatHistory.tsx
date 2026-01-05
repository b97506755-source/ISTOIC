
import React, { useState, useMemo } from 'react';
import { X, History, Trash2, Plus, Search, Edit3, MessageSquare, Flame, Brain, ChevronRight, Pin, PinOff } from 'lucide-react';
import { type ChatThread } from '../../../types';
import { debugService } from '../../../services/debugService';
import { UI_REGISTRY, FN_REGISTRY } from '../../../constants/registry';

interface ChatHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, newTitle: string) => void;
  onTogglePin: (id: string) => void;
  onNewChat: () => void;
}

// Helper for Relative Time
const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
};

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  isOpen,
  onClose,
  threads,
  activeThreadId,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
  onTogglePin,
  onNewChat
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const filteredThreads = useMemo(() => {
    return threads
      .filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.messages.some(m => typeof m.text === 'string' && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => {
        // Sort by Pinned first, then by Date (Newest first)
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Fallback to creation time if update time is same (rare)
        const dateA = new Date(a.updated || 0).getTime();
        const dateB = new Date(b.updated || 0).getTime();
        return dateB - dateA;
      });
  }, [threads, searchQuery]);

  const groups = useMemo(() => {
    const result: Record<string, ChatThread[]> = {
      'PINNED': [],
      'TODAY': [],
      'YESTERDAY': [],
      'PREVIOUS 7 DAYS': [],
      'ARCHIVED LOGS': []
    };

    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    filteredThreads.forEach(t => {
      if (t.isPinned) {
        result['PINNED'].push(t);
        return;
      }

      const date = new Date(t.updated || 0);
      if (date >= today) result['TODAY'].push(t);
      else if (date >= yesterday) result['YESTERDAY'].push(t);
      else if (date >= lastWeek) result['PREVIOUS 7 DAYS'].push(t);
      else result['ARCHIVED LOGS'].push(t);
    });

    return result;
  }, [filteredThreads]);

  const handleStartRename = (e: React.MouseEvent, t: ChatThread) => {
    e.stopPropagation();
    setEditingId(t.id);
    setEditValue(t.title);
  };

  const handleCommitRename = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editingId && editValue.trim()) {
      onRenameThread(editingId, editValue.trim().toUpperCase());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Backdrop with Blur */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[2000] transition-opacity duration-500 ease-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />

      {/* Main Drawer Panel */}
      <div className={`
        fixed inset-y-0 right-0 w-[85%] md:w-[380px] 
        bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-2xl 
        border-l border-black/5 dark:border-white/10 
        z-[2010] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] dark:shadow-[-20px_0_50px_rgba(0,0,0,0.5)]
        transform transition-transform duration-500 cubic-bezier(0.22, 1, 0.36, 1)
        flex flex-col
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        
        {/* HEADER SECTION */}
        <div className="p-6 border-b border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] shrink-0 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg text-accent border border-accent/20">
                <History size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-black dark:text-white leading-none">NEURAL_LOGS</h3>
                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Total {threads.length} Sessions</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-neutral-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-2">
             <button 
                onClick={() => { onNewChat(); onClose(); }}
                className="flex-1 h-12 bg-black dark:bg-white text-white dark:text-black rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
              >
                <Plus size={16} strokeWidth={3} /> NEW_SESSION
              </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-accent transition-colors" size={14} />
            <input 
              type="text"
              placeholder="SEARCH_LOGS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-black/20 border border-black/5 dark:border-white/10 focus:border-accent/50 rounded-xl py-3 pl-10 pr-4 text-[10px] tech-mono font-bold uppercase tracking-widest text-black dark:text-white focus:outline-none transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
            />
          </div>
        </div>

        {/* LIST CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-8">
          {(Object.entries(groups) as [string, ChatThread[]][]).map(([label, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={label} className="animate-fade-in">
                <div className="flex items-center gap-3 mb-3 px-2 opacity-50">
                    <span className={`text-[8px] font-black tracking-[0.3em] uppercase ${label === 'PINNED' ? 'text-accent flex items-center gap-1' : 'text-neutral-500'}`}>
                      {label === 'PINNED' && <Pin size={10} className="inline" />}
                      {label}
                    </span>
                    <div className="h-[1px] flex-1 bg-black/10 dark:bg-white/10"></div>
                </div>
                
                <div className="space-y-2">
                  {items.map(t => {
                    const isActive = activeThreadId === t.id;
                    const isEditing = editingId === t.id;
                    const ModelIcon = t.persona === 'hanisah' ? Flame : Brain;
                    
                    return (
                      <div 
                        key={t.id}
                        onClick={() => { if (!isEditing) { onSelectThread(t.id); if(window.innerWidth < 768) onClose(); } }}
                        className={`
                          group relative p-3.5 rounded-[16px] border transition-all duration-300 cursor-pointer overflow-hidden
                          ${isActive 
                            ? 'bg-white dark:bg-white/[0.08] border-accent/40 shadow-lg shadow-accent/5 ring-1 ring-accent/20' 
                            : 'bg-transparent border-transparent hover:bg-zinc-100 dark:hover:bg-white/[0.03] hover:border-black/5 dark:hover:border-white/5'
                          }
                        `}
                      >
                        {/* Active Indicator Bar */}
                        {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent shadow-[0_0_10px_var(--accent-color)]"></div>
                        )}

                        <div className="flex items-center gap-4 relative z-10">
                          {/* Icon Container */}
                          <div className={`
                            w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all
                            ${isActive 
                                ? 'bg-accent text-black shadow-md' 
                                : 'bg-zinc-200 dark:bg-white/5 text-neutral-400 group-hover:text-black dark:group-hover:text-white'
                            }
                          `}>
                             <ModelIcon size={18} />
                          </div>

                          {/* Text Content */}
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <form onSubmit={handleCommitRename} className="flex items-center gap-2">
                                <input 
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleCommitRename}
                                  className="bg-transparent border-b border-accent w-full text-[11px] font-black uppercase outline-none py-1 text-black dark:text-white"
                                />
                              </form>
                            ) : (
                              <>
                                <div className="flex items-center justify-between mb-1">
                                    <p className={`text-[11px] font-bold uppercase tracking-tight truncate leading-tight flex-1 pr-2 ${isActive ? 'text-black dark:text-white' : 'text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white transition-colors'}`}>
                                      {t.title}
                                    </p>
                                    {t.isPinned && <Pin size={10} className="text-accent shrink-0" />}
                                </div>
                                <p className="text-[9px] tech-mono text-neutral-400 truncate flex items-center gap-2">
                                    <span>{getRelativeTime(t.updated)}</span>
                                    <span className="w-1 h-1 rounded-full bg-neutral-600"></span>
                                    <span>{t.messages.length} MSGS</span>
                                </p>
                              </>
                            )}
                          </div>

                          {/* Actions (Hover Only) */}
                          {!isEditing && (
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onTogglePin(t.id); }}
                                    className={`p-1.5 rounded-lg transition-all ${t.isPinned ? 'text-accent hover:bg-accent/10' : 'text-neutral-400 hover:text-accent hover:bg-accent/10'}`}
                                    title={t.isPinned ? "Unpin" : "Pin to Top"}
                                >
                                    {t.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                                </button>
                                <button 
                                    onClick={(e) => handleStartRename(e, t)}
                                    className="p-1.5 text-neutral-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                                    title="Rename"
                                >
                                    <Edit3 size={14} />
                                </button>
                                <button 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        if (debugService.logAction(UI_REGISTRY.CHAT_BTN_DELETE, FN_REGISTRY.CHAT_DELETE_SESSION, t.id)) {
                                            // Explicit Confirmation
                                            const confirmed = window.confirm(`⚠️ DELETE SESSION\n\nDelete "${t.title}" permanently? This cannot be undone.`);
                                            if (confirmed) {
                                                onDeleteThread(t.id); 
                                            }
                                        }
                                    }} 
                                    className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                          )}
                          
                          {/* Active Chevron (if strictly active and not hovering actions) */}
                          {isActive && !isEditing && (
                              <ChevronRight size={16} className="text-accent group-hover:opacity-0 transition-opacity absolute right-4" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {filteredThreads.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-400 opacity-50 space-y-4">
                  <MessageSquare size={48} strokeWidth={1} />
                  <p className="text-[10px] font-black uppercase tracking-widest">NO_LOGS_FOUND</p>
              </div>
          )}
        </div>
        
        {/* Footer Info */}
        <div className="p-4 border-t border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] text-center shrink-0">
           <p className="text-[8px] tech-mono text-neutral-400 uppercase tracking-widest opacity-60">
                LOCAL_STORAGE_PERSISTENCE // {activeThreadId ? 'ACTIVE' : 'IDLE'}
           </p>
        </div>
      </div>
    </>
  );
};
