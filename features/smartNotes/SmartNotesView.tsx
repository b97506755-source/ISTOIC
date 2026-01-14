import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FileText, Search, Plus, CheckSquare,
  Archive, FolderOpen,
  ListTodo, ArrowUpRight, Hash, Pin, Trash2, BrainCircuit, Brain, Loader2
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { type Note } from '../../types';
import { AdvancedEditor } from './AdvancedEditor';
import { NoteBatchActions } from './NoteBatchActions';
import { NoteAgentConsole } from './NoteAgentConsole';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { debugService } from '../../services/debugService';
import { VectorDB } from '../../services/vectorDb';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { cn } from '../../utils/cn';

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

  // Semantic Search State
  const [isSemanticMode, setIsSemanticMode] = useState(false);
  const [semanticIds, setSemanticIds] = useState<string[]>([]);
  const [isSearchingVector, setIsSearchingVector] = useState(false);

  // Agent Console State
  const [showAgentConsole, setShowAgentConsole] = useState(false);

  // Delete Confirmation State
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
              const ids = await VectorDB.search(searchQuery, 20);
              setSemanticIds(ids);
          } catch (e) {
              console.error('Vector search error', e);
          } finally {
              setIsSearchingVector(false);
          }
      }, 600);

      return () => clearTimeout(timer);
  }, [searchQuery, isSemanticMode]);

  const filteredNotes = useMemo(() => {
    // Semantic Mode Logic
    if (isSemanticMode && searchQuery.trim()) {
        if (semanticIds.length === 0 && !isSearchingVector) return [];
        const matchedNotes = semanticIds
            .map(id => notes.find(n => n.id === id))
            .filter((n): n is Note => !!n);
        return matchedNotes.filter(n => filterType === 'archived' ? n.is_archived : !n.is_archived);
    }

    // Standard Keyword Logic
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
        `Delete ${count} selected note(s)? This action cannot be undone.`
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

  // Agent Handlers
  const handleAgentApply = (updates: Partial<Note>[]) => {
      setNotes(prev => prev.map(n => {
          const update = updates.find(u => u.id === n.id);
          return update ? { ...n, ...update, updated: new Date().toISOString() } : n;
      }));
  };

  const handleAgentTasks = (tasks: any[]) => {
      const newNote: Note = {
          id: uuidv4(),
          title: `Auto tasks ${new Date().toLocaleDateString()}`,
          content: 'Tasks extracted from recent notes.',
          tags: ['AUTO', 'TASKS'],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          tasks: tasks.map(t => ({ id: uuidv4(), text: t.text, isCompleted: false })),
          is_pinned: true
      };
      setNotes(prev => [newNote, ...prev]);
  };

  const noteToDeleteTitle = useMemo(() => {
      if (!noteToDelete) return '';
      const n = notes.find(x => x.id === noteToDelete);
      return n?.title || 'Untitled Note';
  }, [noteToDelete, notes]);

  const isFiltering = filterType === 'archived';
  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden animate-fade-in">
      <header className="px-4 md:px-8 lg:px-10 pt-safe pb-4 shrink-0">
          <Card tone="translucent" padding="lg" className="border-border/60 shadow-[0_30px_120px_-70px_rgba(var(--accent-rgb),0.9)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-3">
                      <p className="caption text-text-muted">Smart Notes</p>
                      <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-[color:var(--accent)]/12 text-[color:var(--accent)] flex items-center justify-center">
                              <FileText size={22} />
                          </div>
                          <div>
                              <h1 className="text-3xl font-black tracking-tight text-text">Notes</h1>
                              <p className="body-sm text-text-muted">Polos, cepat, siap untuk ide penting.</p>
                          </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          <Badge variant="neutral">{notes.length} total</Badge>
                          <Badge variant="neutral">{filteredNotes.length} visible</Badge>
                          <Badge variant={isFiltering ? 'accent' : 'neutral'}>{isFiltering ? 'Archive' : 'Active'}</Badge>
                      </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <div className={cn('relative flex-1 min-w-[240px] md:min-w-[320px]', isSearchFocused ? 'md:w-[380px]' : 'md:w-[340px]')}>
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                          <Input
                             type="text"
                             value={searchQuery}
                             onChange={e => setSearchQuery(e.target.value)}
                             onFocus={handleSearchFocus}
                             onBlur={() => setIsSearchFocused(false)}
                             placeholder={isSemanticMode ? 'Semantic search' : 'Search notes'}
                             className={cn('pl-10 pr-12', isSemanticMode ? 'border-accent/40 text-text' : '')}
                          />
                          <Button
                            onClick={() => { setIsSemanticMode(!isSemanticMode); setSearchQuery(''); }}
                            variant={isSemanticMode ? 'primary' : 'ghost'}
                            size="sm"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                            aria-label="Toggle semantic search"
                          >
                              {isSearchingVector ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                          </Button>
                      </div>

                      <Button
                        onClick={() => setShowAgentConsole(true)}
                        variant="secondary"
                        size="sm"
                        className="h-11 px-3"
                        aria-label="Open note agents"
                      >
                          <BrainCircuit size={18} />
                      </Button>

                      <Button
                        onClick={handleToggleBatchMode}
                        variant={isSelectionMode ? 'primary' : 'secondary'}
                        size="sm"
                        className="h-11 px-3"
                        aria-label="Toggle selection mode"
                      >
                          <CheckSquare size={18} />
                      </Button>

                      <Button
                        onClick={handleToggleFilter}
                        variant={isFiltering ? 'primary' : 'secondary'}
                        size="sm"
                        className="h-11 px-3"
                        aria-label={isFiltering ? 'Show active notes' : 'Show archived notes'}
                      >
                          <Archive size={18} />
                      </Button>

                      <Button
                        onClick={handleCreateNote}
                        variant="primary"
                        size="md"
                        className="h-11 px-4"
                      >
                         <Plus size={16} strokeWidth={2.5} /> New
                      </Button>
                  </div>
              </div>
          </Card>
      </header>

      {(isFiltering || isSearching) && (
          <div className="px-4 md:px-8 lg:px-10 pb-3 flex flex-wrap items-center gap-2">
              {isFiltering && <Badge variant="accent">Archive</Badge>}
              {isSearching && (
                  <Badge variant={isSemanticMode ? 'accent' : 'neutral'}>
                      {isSemanticMode ? 'Semantic search' : 'Search'}
                  </Badge>
              )}
              <Badge variant="neutral">{filteredNotes.length} items</Badge>
          </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scroll px-4 md:px-8 lg:px-10 pb-32">
          {filteredNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted gap-4">
                  <Card padding="lg" className="flex flex-col items-center text-center gap-3 max-w-md">
                      <div className="w-12 h-12 rounded-[var(--radius-md)] bg-surface-2 border border-border flex items-center justify-center text-text-muted">
                          {isSemanticMode ? <BrainCircuit size={24} strokeWidth={1.6} /> : filterType === 'archived' ? <Archive size={24} strokeWidth={1.6} /> : <FolderOpen size={24} strokeWidth={1.6} />}
                      </div>
                      <div className="section-title text-text">{isSemanticMode ? 'No semantic matches' : 'No notes yet'}</div>
                      <p className="body text-text-muted">
                          {isSemanticMode ? 'Try adjusting your query.' : filterType === 'archived' ? 'No archived notes found.' : 'Create your first note to get started.'}
                      </p>
                  </Card>
              </div>
          ) : (
              <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6 pb-20">
                  {filteredNotes.map((n) => {
                      const isSelected = selectedIds.has(n.id);
                      const completedTasks = n.tasks?.filter(t => t.isCompleted).length || 0;
                      const totalTasks = n.tasks?.length || 0;
                      const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

                      return (
                          <Card
                              as="button"
                              key={n.id}
                              onClick={() => handleNoteClick(n)}
                              interactive
                              padding="lg"
                              className={cn(
                                  'break-inside-avoid w-full text-left relative transition-all',
                                  isSelected ? 'border-accent bg-accent/10 ring-1 ring-accent/30' : 'bg-surface'
                              )}
                          >
                              {isSelectionMode && (
                                  <div className={cn(
                                      'absolute top-4 right-4 w-6 h-6 rounded-full border flex items-center justify-center',
                                      isSelected ? 'bg-accent text-text-invert border-accent' : 'border-border text-text-muted'
                                  )}>
                                      {isSelected && <CheckSquare size={12} strokeWidth={2.5} />}
                                  </div>
                              )}

                              {n.is_pinned && !isSelectionMode && (
                                  <Badge variant="accent" className="absolute top-4 right-4">
                                      <Pin size={12} /> Pinned
                                  </Badge>
                              )}

                              <div className="space-y-4">
                                  <div className="flex items-start gap-3">
                                      <div className={cn(
                                          'w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 border',
                                          isSelected ? 'bg-accent text-text-invert border-accent' : 'bg-surface-2 border-border text-text-muted'
                                      )}>
                                          <FileText size={18} strokeWidth={1.8} />
                                      </div>
                                      <div className="flex-1 min-w-0 pt-0.5">
                                          <h3 className="section-title text-text truncate">
                                              {n.title || 'Untitled note'}
                                          </h3>
                                          <p className="caption text-text-muted truncate">
                                              {new Date(n.updated).toLocaleDateString()} - ID {n.id.slice(0, 4)}
                                          </p>
                                      </div>
                                  </div>

                                  <p className="body text-text-muted line-clamp-3">
                                      {n.content.replace(/<[^>]*>/g, ' ').slice(0, 150) || 'No preview available.'}
                                  </p>

                                  {totalTasks > 0 && (
                                      <div className="space-y-2">
                                          <div className="flex justify-between items-center caption text-text-muted">
                                              <span className="flex items-center gap-1"><ListTodo size={12} /> Tasks</span>
                                              <span>{Math.round(taskProgress)}%</span>
                                          </div>
                                          <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
                                              <div className="h-full bg-accent transition-all duration-700" style={{ width: `${taskProgress}%` }} />
                                          </div>
                                      </div>
                                  )}

                                  {n.tags?.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                          {n.tags?.map((tag, i) => (
                                              <Badge key={i} variant="neutral">
                                                  <Hash size={10} /> {tag}
                                              </Badge>
                                          ))}
                                      </div>
                                  )}
                              </div>

                              {!isSelectionMode && (
                                  <div className="absolute top-4 right-4 hidden md:flex items-center gap-2">
                                      <Button
                                          onClick={(e) => initiateDelete(e, n.id)}
                                          variant="ghost"
                                          size="sm"
                                          className="w-8 h-8 p-0 text-danger hover:bg-danger/10"
                                          aria-label="Delete note"
                                      >
                                          <Trash2 size={14} />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="w-8 h-8 p-0" aria-hidden="true">
                                          <ArrowUpRight size={14} />
                                      </Button>
                                  </div>
                              )}
                          </Card>
                      );
                  })}
              </div>
          )}
      </div>

      <div className={cn(
          'fixed inset-0 z-[1500] bg-bg transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] flex flex-col',
          viewMode === 'editor' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      )}>
          {activeNoteId && (
              <div className="flex flex-col h-full max-w-6xl mx-auto w-full p-0 md:p-6 lg:p-8">
                  <Card className="flex-1 rounded-none md:rounded-[var(--radius-lg)] overflow-hidden" padding="none">
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
                  </Card>
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

      <Dialog
          open={Boolean(noteToDelete)}
          onClose={() => setNoteToDelete(null)}
          title="Delete note"
          size="sm"
          footer={
              <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setNoteToDelete(null)}>Cancel</Button>
                  <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
              </div>
          }
      >
          <div className="space-y-3">
              <p className="section-title text-text">Remove "{noteToDeleteTitle}"?</p>
              <p className="body text-text-muted">This action cannot be undone.</p>
          </div>
      </Dialog>
    </div>
  );
};
