import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  FileText, Search, Plus, CheckSquare, 
  Archive, FolderOpen, Database, 
  ListTodo, ArrowUpRight, Hash, Pin, Trash2, X, Filter, BrainCircuit, AlertTriangle, ShieldAlert, Sparkles, Brain, Loader2
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { type Note } from '../../types';
import { AdvancedEditor } from './AdvancedEditor';
import { NoteBatchActions } from './NoteBatchActions';
import { NoteAgentConsole } from './NoteAgentConsole';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { debugService } from '../../services/debugService';
import { VectorDB } from '../../services/vectorDb';

interface SmartNotesViewProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}

export const SmartNotesView: React.FC<SmartNotesViewProps> = ({ notes, setNotes }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'editor'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'archived'>('all');
  const [editorFontSize, setEditorFontSize] = useState(16);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // NEW: Semantic Search State
  const [isSemanticMode, setIsSemanticMode] = useState(false);
  const [semanticIds, setSemanticIds] = useState<string[]>([]);
  const [isSearchingVector, setIsSearchingVector] = useState(false);
  
  // NEW: Agent Console State
  const [showAgentConsole, setShowAgentConsole] = useState(false);

  // NEW: Delete Confirmation State
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Safety check: if active note is deleted externally
  useEffect(() => {
      if (activeNoteId && !notes.find(n => n.id === activeNoteId)) {
          setActiveNoteId(null);
          setViewMode('grid');
      }
  }, [notes, activeNoteId]);

  // Semantic Search Effect
  useEffect(() => {
      if (!searchQuery.trim() || !isSemanticMode) {
          setSemanticIds([]);
          setIsSearchingVector(false);
          return;
      }

      const timer = setTimeout(async () => {
          setIsSearchingVector(true);
          try {
              // Search with a higher limit for UI list
              const ids = await VectorDB.search(searchQuery, 20);
              setSemanticIds(ids);
          } catch (e) {
              console.error("Vector search error", e);
          } finally {
              setIsSearchingVector(false);
          }
      }, 600);

      return () => clearTimeout(timer);
  }, [searchQuery, isSemanticMode]);

  const filteredNotes = useMemo(() => {
    // 1. Semantic Mode Logic
    if (isSemanticMode && searchQuery.trim()) {
        if (semanticIds.length === 0 && !isSearchingVector) return [];
        // Map IDs to notes and preserve order (relevance)
        const matchedNotes = semanticIds
            .map(id => notes.find(n => n.id === id))
            .filter((n): n is Note => !!n);
            
        // Still apply archive filter
        return matchedNotes.filter(n => filterType === 'archived' ? n.is_archived : !n.is_archived);
    }

    // 2. Standard Keyword Logic
    return notes
      .filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              n.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesType = filterType === 'archived' ? n.is_archived : !n.is_archived;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
         if (a.is_pinned && !b.is_pinned) return -1;
         if (!a.is_pinned && b.is_pinned) return 1;
         return new Date(b.updated).getTime() - new Date(a.updated).getTime();
      });
  }, [notes, searchQuery, filterType, isSemanticMode, semanticIds, isSearchingVector]);

  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId]);

  // Strict Handlers
  const handleCreateNote = () => {
    debugService.logAction(UI_REGISTRY.NOTES_BTN_CREATE, FN_REGISTRY.NOTE_CREATE, 'NEW_NOTE');
    const newNote: Note = {
      id: uuidv4(),
      title: '', 
      content: '',
      tags: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tasks: [],
      is_pinned: false,
      is_archived: false
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setViewMode('editor');
  };

  const handleSearchFocus = () => {
      debugService.logAction(UI_REGISTRY.NOTES_INPUT_SEARCH, FN_REGISTRY.NOTE_SEARCH, 'FOCUS');
      setIsSearchFocused(true);
  };

  const handleToggleFilter = () => {
      const newFilter = filterType === 'all' ? 'archived' : 'all';
      debugService.logAction(UI_REGISTRY.NOTES_BTN_FILTER_ARCHIVE, FN_REGISTRY.NOTE_SEARCH, newFilter.toUpperCase());
      setFilterType(newFilter);
  };

  const handleToggleBatchMode = () => {
      debugService.logAction(UI_REGISTRY.NOTES_BTN_BATCH_MODE, FN_REGISTRY.NOTE_BATCH_ACTION, isSelectionMode ? 'OFF' : 'ON');
      setIsSelectionMode(!isSelectionMode);
      if (isSelectionMode) setSelectedIds(new Set()); 
  };

  const handleNoteClick = (n: Note) => {
      if (isSelectionMode) {
          toggleSelection(n.id);
      } else {
          debugService.logAction(UI_REGISTRY.NOTES_CARD_ITEM, FN_REGISTRY.NOTE_UPDATE, 'OPEN_EDITOR');
          setActiveNoteId(n.id);
          setViewMode('editor');
      }
  };

  const initiateDelete = (e: React.MouseEvent | null, id: string) => {
      if (e) {
          e.stopPropagation();
          e.preventDefault();
      }
      setNoteToDelete(id);
  };

  const confirmDelete = () => {
      if (!noteToDelete) return;

      if (debugService.logAction(UI_REGISTRY.NOTES_BTN_DELETE_ITEM, FN_REGISTRY.NOTE_DELETE, noteToDelete)) {
          setNotes(prevNotes => prevNotes.filter(n => n.id !== noteToDelete));
          
          // If we deleted the active note (from within editor), go back to grid
          if (activeNoteId === noteToDelete) {
              setActiveNoteId(null);
              setViewMode('grid');
          }
      }
      setNoteToDelete(null);
  };

  const handleSaveNote = useCallback((title: string, content: string, tasks?: any[], tags?: string[]) => {
    if (!activeNoteId) return;
    setNotes(prevNotes => prevNotes.map(n => {
      if (n.id === activeNoteId) {
         return { 
             ...n, 
             content, 
             title: title.trim() || 'Untitled Note', 
             tasks: tasks || n.tasks, 
             tags: tags || n.tags, 
             updated: new Date().toISOString() 
         };
      }
      return n;
    }));
  }, [activeNoteId, setNotes]);

  const handleBackFromEditor = useCallback(() => {
      if (activeNoteId) {
          const current = notes.find(n => n.id === activeNoteId);
          if (current) {
              const isEmpty = !current.title.trim() && (!current.content || current.content === '<div><br></div>') && (!current.tasks || current.tasks.length === 0);
              if (isEmpty) {
                  setNotes(prev => prev.filter(n => n.id !== activeNoteId));
              }
          }
      }
      setActiveNoteId(null);
      setViewMode('grid');
  }, [activeNoteId, notes, setNotes]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const batchDelete = useCallback(() => {
    const count = selectedIds.size;
    if (count === 0) return;
    
    const idsToDelete = new Set(selectedIds);
    const confirmPurge = window.confirm(
        `⚠️ SYSTEM PURGE PROTOCOL\n\nYou are about to PERMANENTLY DELETE ${count} selected item(s).\n\nThis is a destructive action. Data will be unrecoverable.\n\nProceed with purge?`
    );

    if (confirmPurge) {
        debugService.logAction(UI_REGISTRY.NOTES_BTN_BATCH_MODE, FN_REGISTRY.NOTE_BATCH_ACTION, 'PURGE_EXECUTE', { count });
        setNotes(prevNotes => prevNotes.filter(n => !idsToDelete.has(n.id)));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
    }
  }, [selectedIds, setNotes]);

  const batchArchive = useCallback(() => {
      debugService.logAction(UI_REGISTRY.NOTES_BTN_BATCH_MODE, FN_REGISTRY.NOTE_BATCH_ACTION, 'ARCHIVE_MANY');
      const selected = notes.filter(n => selectedIds.has(n.id));
      const allArchived = selected.every(n => n.is_archived);
      const targetState = !allArchived;

      setNotes(prevNotes => prevNotes.map(n => selectedIds.has(n.id) ? { ...n, is_archived: targetState } : n));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
  }, [notes, selectedIds, setNotes]);
  
  const batchPin = useCallback(() => {
      debugService.logAction(UI_REGISTRY.NOTES_BTN_BATCH_MODE, FN_REGISTRY.NOTE_BATCH_ACTION, 'PIN_MANY');
      const selected = notes.filter(n => selectedIds.has(n.id));
      const allPinned = selected.every(n => n.is_pinned);
      const targetState = !allPinned;

      setNotes(prevNotes => prevNotes.map(n => selectedIds.has(n.id) ? { ...n, is_pinned: targetState } : n));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
  }, [notes, selectedIds, setNotes]);

  const handleSelectAll = useCallback(() => {
      const visibleIds = filteredNotes.map(n => n.id);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
      
      const newSet = new Set(selectedIds);
      if (allVisibleSelected) {
          visibleIds.forEach(id => newSet.delete(id));
      } else {
          visibleIds.forEach(id => newSet.add(id));
      }
      setSelectedIds(newSet);
  }, [filteredNotes, selectedIds]);

  // --- AGENT HANDLERS ---
  const handleAgentApply = (updates: Partial<Note>[]) => {
      setNotes(prev => prev.map(n => {
          const update = updates.find(u => u.id === n.id);
          return update ? { ...n, ...update, updated: new Date().toISOString() } : n;
      }));
  };

  const handleAgentTasks = (tasks: any[]) => {
      const newNote: Note = {
          id: uuidv4(),
          title: `AUTO-TASKS ${new Date().toLocaleDateString()}`,
          content: 'Tasks extracted from recent notes.',
          tags: ['AUTO', 'TASKS'],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          tasks: tasks.map(t => ({ id: uuidv4(), text: t.text, isCompleted: false })),
          is_pinned: true
      };
      setNotes(prev => [newNote, ...prev]);
  };

  // Helper to find title of note being deleted for the modal
  const noteToDeleteTitle = useMemo(() => {
      if (!noteToDelete) return "";
      const n = notes.find(x => x.id === noteToDelete);
      return n?.title || "Untitled Note";
  }, [noteToDelete, notes]);

  return (
    <div className="h-[calc(100dvh-2rem)] md:h-[calc(100vh-2rem)] flex flex-col animate-fade-in bg-noise overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="px-4 md:px-8 lg:px-12 pb-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:pt-8 shrink-0 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 z-20">
          <div className="space-y-3 w-full xl:w-auto">
              <div className="flex items-center gap-3 animate-slide-down">
                  <div className="px-3 py-1 rounded-lg bg-accent/10 border border-accent/20 tech-mono text-[9px] font-black uppercase text-accent tracking-[0.3em]">
                      SECURE_VAULT_v2
                  </div>
                  <span className="text-skin-muted tech-mono text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <Database size={10} /> ENCRYPTED_STORAGE
                  </span>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black italic tracking-tighter text-skin-text leading-[0.85] uppercase drop-shadow-sm animate-slide-down" style={{ animationDelay: '50ms' }}>
                  SMART <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-500 animate-gradient-text">VAULT</span>
              </h1>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto animate-slide-down" style={{ animationDelay: '100ms' }}>
               
               {/* Search Bar - Responsive Growth */}
               <div className={`relative transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isSearchFocused ? 'flex-1 md:w-96' : 'flex-1 md:w-64'}`}>
                  <input 
                     type="text" 
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     onFocus={handleSearchFocus}
                     onBlur={() => setIsSearchFocused(false)}
                     placeholder={isSearchFocused ? (isSemanticMode ? "NEURAL SEARCH..." : "KEYWORD SEARCH...") : "SEARCH..."}
                     className={`w-full h-12 bg-skin-card border rounded-2xl pl-11 pr-12 text-[10px] font-black uppercase tracking-widest focus:outline-none transition-all placeholder:text-skin-muted sheen
                        ${isSemanticMode 
                            ? 'border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)] text-purple-500' 
                            : 'border-skin-border focus:border-accent/50 focus:shadow-[0_0_30px_-10px_var(--accent-glow)] text-skin-text'
                        }
                     `}
                  />
                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isSemanticMode ? 'text-purple-500' : isSearchFocused ? 'text-accent' : 'text-skin-muted'}`} size={16} />
                  
                  {/* Semantic Toggle */}
                  <button 
                    onClick={() => { setIsSemanticMode(!isSemanticMode); setSearchQuery(''); }}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                        isSemanticMode 
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                        : 'text-skin-muted hover:text-skin-text hover:bg-skin-surface'
                    }`}
                    title="Toggle Neural Search"
                  >
                      {isSearchingVector ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                  </button>
               </div>

               {/* Action Buttons - Grouped for Mobile */}
               <div className="flex items-center gap-2">
                   {/* Agent Button - Prominent */}
                   <button 
                     onClick={() => setShowAgentConsole(true)}
                     className="w-12 h-12 flex items-center justify-center rounded-2xl border bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-purple-400 transition-all shadow-sm active:scale-90 group"
                     title="Neural Agents"
                   >
                      <BrainCircuit size={20} className="group-hover:scale-110 transition-transform" />
                   </button>

                   <button 
                     onClick={handleToggleBatchMode}
                     className={`w-12 h-12 flex items-center justify-center rounded-2xl border transition-all active:scale-90 group ${isSelectionMode ? 'bg-accent text-black border-accent shadow-[0_0_20px_var(--accent-glow)]' : 'bg-skin-card border-skin-border text-skin-muted hover:text-skin-text hover:border-skin-highlight'}`}
                     title="Batch Select"
                   >
                      <CheckSquare size={18} className="group-hover:scale-110 transition-transform" />
                   </button>
                   
                   <button 
                     onClick={handleToggleFilter}
                     className={`w-12 h-12 flex items-center justify-center rounded-2xl border transition-all active:scale-90 group ${filterType === 'archived' ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20' : 'bg-skin-card border-skin-border text-skin-muted hover:text-skin-text hover:border-skin-highlight'}`}
                     title={filterType === 'all' ? "View Archive" : "Back to Active"}
                   >
                      {filterType === 'archived' ? <Archive size={18} fill="currentColor" /> : <Archive size={18} className="group-hover:scale-110 transition-transform" />}
                   </button>

                   <button 
                    onClick={handleCreateNote}
                    className="h-12 px-6 bg-[var(--accent-color)] text-black rounded-2xl flex items-center gap-3 font-black uppercase text-[10px] tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_var(--accent-glow)] group border border-white/20"
                  >
                     <Plus size={16} strokeWidth={3} className="group-hover:rotate-90 transition-transform" /> <span className="hidden md:inline">CREATE</span>
                  </button>
               </div>
          </div>
      </div>

      {/* FILTER BAR INDICATOR */}
      {(filterType === 'archived' || searchQuery) && (
          <div className="px-4 md:px-8 lg:px-12 pb-4 flex items-center gap-2 animate-fade-in">
              <div className="h-[1px] bg-skin-border flex-1"></div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest shadow-sm ${isSemanticMode ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' : 'bg-skin-surface border-skin-border text-skin-muted'}`}>
                  {isSemanticMode ? <Sparkles size={10} /> : <Filter size={10} />}
                  {filterType === 'archived' && <span>ARCHIVE_MODE</span>}
                  {filterType === 'archived' && searchQuery && <span>+</span>}
                  {searchQuery && (isSemanticMode ? <span>NEURAL_MATCH</span> : <span>KEYWORD_MATCH</span>)}
                  <span className={`ml-1 border-l pl-2 ${isSemanticMode ? 'text-purple-400 border-purple-500/20' : 'text-accent border-skin-border'}`}>{filteredNotes.length} ITEMS</span>
              </div>
              <div className="h-[1px] bg-skin-border flex-1"></div>
          </div>
      )}

      {/* CONTENT GRID */}
      <div className="flex-1 overflow-y-auto custom-scroll px-4 md:px-8 lg:px-12 pb-32">
          {filteredNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-skin-muted opacity-40 gap-6 animate-fade-in">
                  <div className="w-32 h-32 rounded-[40px] bg-skin-surface border border-skin-border flex items-center justify-center rotate-3">
                      {isSemanticMode ? <BrainCircuit size={48} strokeWidth={1} className="text-purple-500" /> : filterType === 'archived' ? <Archive size={48} strokeWidth={1} /> : <FolderOpen size={48} strokeWidth={1} />}
                  </div>
                  <div className="text-center space-y-2">
                      <p className="text-xs font-black uppercase tracking-[0.3em]">{isSemanticMode ? "NO_SEMANTIC_MATCHES" : "NO_RECORDS_FOUND"}</p>
                      <p className="text-[10px] font-mono">{isSemanticMode ? "Try rephrasing your query." : "Vault sector is empty."}</p>
                  </div>
              </div>
          ) : (
              <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6 pb-20">
                  {filteredNotes.map((n) => {
                      const isSelected = selectedIds.has(n.id);
                      const completedTasks = n.tasks?.filter(t => t.isCompleted).length || 0;
                      const totalTasks = n.tasks?.length || 0;
                      const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

                      return (
                          <div 
                              key={n.id} 
                              onClick={() => handleNoteClick(n)} 
                              className={`
                                  break-inside-avoid relative p-6 rounded-[32px] cursor-pointer transition-all duration-300 ease-out group
                                  border hover:-translate-y-1 active:scale-[0.99]
                                  ${isSelected 
                                      ? 'bg-accent/10 border-accent shadow-[0_0_40px_-10px_var(--accent-glow)]' 
                                      : 'bg-skin-card/80 backdrop-blur-md border-skin-border hover:border-accent/30 hover:shadow-xl sheen'
                                  }
                              `}
                          >
                              {isSelectionMode && (
                                  <div className={`absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-20 ${isSelected ? 'bg-accent border-accent text-black' : 'border-neutral-400 bg-transparent'}`}>
                                      {isSelected && <CheckSquare size={12} strokeWidth={3} />}
                                  </div>
                              )}

                              {n.is_pinned && !isSelectionMode && (
                                  <div className="absolute top-6 right-6 text-accent animate-pulse">
                                      <Pin size={16} fill="currentColor" />
                                  </div>
                              )}

                              <div className="space-y-4">
                                  <div className="flex items-start gap-4">
                                      <div className={`
                                          w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 border
                                          ${isSelected ? 'bg-accent text-black border-transparent' : 'bg-skin-surface border-skin-border text-skin-muted group-hover:text-accent group-hover:bg-accent/10 group-hover:border-accent/20'}
                                      `}>
                                          <FileText size={20} strokeWidth={2} />
                                      </div>
                                      <div className="flex-1 min-w-0 pt-1">
                                          <h3 className={`text-lg font-black uppercase tracking-tight truncate leading-none mb-1 ${isSelected ? 'text-accent' : 'text-skin-text group-hover:text-accent transition-colors'}`}>
                                              {n.title || 'UNTITLED_ENTRY'}
                                          </h3>
                                          <div className="flex items-center gap-2 text-[8px] tech-mono font-bold text-skin-muted uppercase tracking-wider">
                                              <span>{new Date(n.updated).toLocaleDateString()}</span>
                                              <span className="w-1 h-1 rounded-full bg-neutral-600"></span>
                                              <span>ID: {n.id.slice(0,4)}</span>
                                          </div>
                                      </div>
                                  </div>

                                  <p className="text-[11px] text-skin-muted font-medium leading-relaxed line-clamp-3">
                                      {n.content.replace(/<[^>]*>/g, ' ').slice(0, 150) || "No preview data available."}
                                  </p>

                                  {totalTasks > 0 && (
                                      <div className="space-y-1.5 pt-1">
                                          <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-skin-muted">
                                              <span className="flex items-center gap-1"><ListTodo size={10} /> TASKS</span>
                                              <span>{Math.round(taskProgress)}%</span>
                                          </div>
                                          <div className="h-1.5 w-full bg-skin-border rounded-full overflow-hidden">
                                              <div className="h-full bg-accent transition-all duration-700" style={{ width: `${taskProgress}%` }} />
                                          </div>
                                      </div>
                                  )}

                                  <div className="flex flex-wrap gap-2 pt-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                      {n.tags?.map((tag, i) => (
                                          <span key={i} className="px-2 py-1 rounded bg-skin-surface border border-skin-border text-[8px] font-bold uppercase text-skin-muted flex items-center gap-1">
                                              <Hash size={8} /> {tag}
                                          </span>
                                      ))}
                                  </div>
                              </div>

                              {!isSelectionMode && (
                                  <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 hidden md:flex z-20">
                                      {!n.is_pinned && (
                                        <button 
                                            onClick={(e) => initiateDelete(e, n.id)}
                                            className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center border border-red-500/20 shadow-sm transition-all active:scale-90"
                                            title="Delete Note"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                      )}
                                      <div className="w-8 h-8 rounded-full bg-skin-text text-skin-card flex items-center justify-center shadow-sm">
                                          <ArrowUpRight size={14} />
                                      </div>
                                  </div>
                              )}
                          </div>
                      );
                  })}
              </div>
          )}
      </div>

      {/* EDITOR OVERLAY */}
      <div className={`
          fixed inset-0 z-[1500] bg-skin-main transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] flex flex-col
          ${viewMode === 'editor' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}
      `}>
          {activeNoteId && (
              <div className="flex flex-col h-full max-w-[1400px] mx-auto w-full p-0 md:p-6 lg:p-8">
                  <div className="flex-1 bg-skin-card rounded-none md:rounded-[48px] border-x-0 md:border border-skin-border shadow-2xl overflow-hidden relative flex flex-col md:ring-1 ring-white/10 sheen">
                      
                      <AdvancedEditor 
                          key={activeNoteId}
                          initialContent={activeNote?.content || ''}
                          initialTitle={activeNote?.title || ''}
                          initialTasks={activeNote?.tasks || []}
                          initialTags={activeNote?.tags || []}
                          onSave={handleSaveNote}
                          onDelete={() => initiateDelete(null, activeNoteId!)}
                          onBack={handleBackFromEditor}
                          language="en"
                          fontSize={editorFontSize}
                          onFontSizeChange={setEditorFontSize} 
                      />
                  </div>
              </div>
          )}
      </div>

      <NoteBatchActions 
          isSelectionMode={isSelectionMode}
          selectedCount={selectedIds.size}
          totalVisibleCount={filteredNotes.length}
          isViewingArchive={filterType === 'archived'}
          selectedNotes={notes.filter(n => selectedIds.has(n.id))}
          onSelectAll={handleSelectAll}
          onDeselectAll={() => setSelectedIds(new Set())}
          onDeleteSelected={batchDelete}
          onArchiveSelected={batchArchive}
          onPinSelected={batchPin}
          onCancel={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
      />

      <NoteAgentConsole 
          isOpen={showAgentConsole}
          onClose={() => setShowAgentConsole(false)}
          notes={notes}
          onApplyUpdates={handleAgentApply}
          onAddTasks={handleAgentTasks}
      />

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {noteToDelete && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-skin-card w-full max-w-sm rounded-[32px] border border-red-500/20 shadow-[0_20px_50px_-10px_rgba(239,68,68,0.15)] p-8 animate-slide-up flex flex-col items-center text-center relative overflow-hidden">
                  
                  {/* Pulse Effect Background */}
                  <div className="absolute inset-0 bg-red-500/5 pointer-events-none animate-pulse-slow"></div>

                  <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                      <ShieldAlert size={36} strokeWidth={1.5} />
                  </div>

                  <h3 className="text-2xl font-black italic tracking-tighter text-skin-text uppercase mb-2">
                      DELETE NOTE?
                  </h3>
                  
                  <p className="text-[10px] font-medium text-neutral-500 mb-2 font-mono uppercase tracking-widest">
                      ID: {noteToDelete.slice(0, 8)}
                  </p>

                  <p className="text-sm text-skin-muted mb-8 leading-relaxed max-w-[240px]">
                      Are you sure you want to purge <span className="font-bold text-skin-text">"{noteToDeleteTitle}"</span>? This action is permanent and cannot be undone.
                  </p>

                  <div className="grid grid-cols-2 gap-3 w-full relative z-10">
                      <button 
                          onClick={() => setNoteToDelete(null)}
                          className="py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] text-skin-muted hover:text-skin-text bg-skin-surface hover:bg-skin-surface-hover transition-all active:scale-95"
                      >
                          CANCEL
                      </button>
                      <button 
                          onClick={confirmDelete}
                          className="py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-red-500/40 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                          <Trash2 size={14} /> PURGE
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
