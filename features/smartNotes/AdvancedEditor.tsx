import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Bold, Italic, Underline, Maximize2, Minimize2, 
  Mic, MicOff, Sparkles, X, RefreshCw, Flame, CheckCircle,
  List, ListOrdered, Code, Wand2, Clock, Heading1, Heading2,
  Type, CheckSquare, Trash2, Plus, ArrowLeft, Check, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, Undo, Redo, Quote,
  ChevronDown, Type as FontIcon, AlignJustify, MoreHorizontal,
  Pilcrow
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { HANISAH_KERNEL } from '../../services/melsaKernel';
import { type TaskItem } from '../../types';
import { TRANSLATIONS, getLang } from '../../services/i18n';

interface AdvancedEditorProps {
  initialContent: string;
  initialTitle: string;
  initialTasks?: TaskItem[];
  initialTags?: string[];
  onSave: (title: string, content: string, tasks: TaskItem[], tags: string[]) => void;
  onDelete: () => void;
  onBack: () => void;
  language: 'id' | 'en';
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}

const FONTS = [
    { label: 'Sans', value: 'Plus Jakarta Sans, sans-serif' },
    { label: 'Mono', value: 'JetBrains Mono, monospace' },
    { label: 'Serif', value: 'Playfair Display, serif' },
];

const ToolbarButton: React.FC<{ onClick: (e: React.MouseEvent) => void; icon: React.ReactNode; isActive?: boolean; ariaLabel: string; className?: string; label?: string }> = ({ onClick, icon, isActive, ariaLabel, className, label }) => (
    <button 
        onMouseDown={(e) => { e.preventDefault(); onClick(e); }} 
        className={`
            relative flex items-center justify-center gap-1.5 rounded-lg transition-all duration-200 shrink-0
            ${label ? 'px-3 w-auto' : 'w-8'} h-8
            ${isActive 
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' 
                : 'text-neutral-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
            } ${className}
        `}
        aria-label={ariaLabel}
        type="button"
        title={ariaLabel}
    >
        {icon}
        {label && <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>}
    </button>
);

const ToolbarDivider = () => <div className="w-[1px] h-4 bg-skin-border mx-1 shrink-0 self-center"></div>;

const WRITER_PRESETS = [
    { id: 'GRAMMAR', label: 'FIX_GRAMMAR', icon: <CheckCircle size={12}/>, prompt: "Correct grammar and spelling errors. Keep the tone natural." },
    { id: 'FORMAL', label: 'PROFESSIONAL', icon: <Type size={12}/>, prompt: "Rewrite to be more professional, concise, and executive-ready." },
    { id: 'EXPAND', label: 'EXPAND', icon: <Wand2 size={12}/>, prompt: "Elaborate on this point. Add detail and context." },
    { id: 'SUMMARIZE', label: 'SUMMARIZE', icon: <Minimize2 size={12}/>, prompt: "Summarize the key points into a concise list or paragraph." },
];

export const AdvancedEditor: React.FC<AdvancedEditorProps> = ({ 
    initialContent, 
    initialTitle,
    initialTasks = [],
    initialTags = [],
    onSave,
    onDelete, 
    onBack,
    language, 
    fontSize, 
    onFontSizeChange 
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const currentLang = getLang();
  const t = TRANSLATIONS[currentLang].editor;
  
  // Core State
  const [title, setTitle] = useState(initialTitle);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [isReadonly, setIsReadonly] = useState(false);
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  
  // Editor State
  const [isDictating, setIsDictating] = useState(false);
  const [currentFont, setCurrentFont] = useState(FONTS[0].value);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'SAVED' | 'SYNCING'>('SAVED');
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);
  
  // Formatting State
  const [formats, setFormats] = useState({
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      ul: false,
      ol: false,
      justifyLeft: false,
      justifyCenter: false,
      justifyRight: false,
      code: false,
      h1: false,
      h2: false,
      quote: false
  });
  
  // AI State
  const [showHanisahOverlay, setShowHanisahOverlay] = useState(false);
  const [hanisahInstruction, setHanisahInstruction] = useState('');
  const [isHanisahProcessing, setIsHanisahProcessing] = useState(false);
  const [hanisahResult, setHanisahResult] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);

  const recognitionRef = useRef<any>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync tasks logic
  const completedTasksCount = tasks.filter(t => t.isCompleted).length;
  const taskProgress = tasks.length > 0 ? (completedTasksCount / tasks.length) * 100 : 0;

  const updateStatsAndFormats = useCallback(() => {
    if (!editorRef.current) return;
    
    // Stats
    const text = editorRef.current.innerText || "";
    const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    setWordCount(words);
    setReadTime(Math.ceil(words / 200)); 

    // Formats (Only if editable)
    if (!isReadonly) {
        const formatBlock = document.queryCommandValue('formatBlock');
        setFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strikethrough: document.queryCommandState('strikethrough'),
            ul: document.queryCommandState('insertUnorderedList'),
            ol: document.queryCommandState('insertOrderedList'),
            justifyLeft: document.queryCommandState('justifyLeft'),
            justifyCenter: document.queryCommandState('justifyCenter'),
            justifyRight: document.queryCommandState('justifyRight'),
            code: formatBlock === 'pre',
            h1: typeof formatBlock === 'string' && formatBlock.toLowerCase() === 'h1',
            h2: typeof formatBlock === 'string' && formatBlock.toLowerCase() === 'h2',
            quote: formatBlock === 'blockquote'
        });
        
        // Detect Font
        const fontName = document.queryCommandValue('fontName');
        if(fontName) {
            // Browser returns font name with quotes sometimes
            const cleanFont = fontName.replace(/['"]+/g, '');
            // Try to match with our presets
            const matched = FONTS.find(f => f.value.includes(cleanFont));
            if(matched) setCurrentFont(matched.value);
        }
    }
  }, [isReadonly]);

  // Init
  useEffect(() => {
    if (editorRef.current) {
        if (editorRef.current.innerHTML !== initialContent) {
            editorRef.current.innerHTML = initialContent || '<div><br></div>';
        }
        setTitle(initialTitle);
        setTasks(initialTasks);
        setTags(initialTags);
        updateStatsAndFormats();
    }
  }, [initialContent, initialTitle, initialTasks, initialTags]);

  const performSave = useCallback((currentTitle: string, currentContent: string, currentTasks: TaskItem[], currentTags: string[]) => {
    onSave(currentTitle, currentContent, currentTasks, currentTags);
    setSyncStatus('SAVED');
  }, [onSave]);

  // Trigger auto save with current state
  const triggerAutoSave = useCallback(() => {
      setSyncStatus('SYNCING');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      const contentToSave = editorRef.current?.innerHTML || '';
      
      saveTimeoutRef.current = setTimeout(() => {
          performSave(title, contentToSave, tasks, tags);
      }, 800);
  }, [title, tasks, tags, performSave]);

  // Ensure tasks change triggers save
  useEffect(() => {
      if (tasks !== initialTasks) {
          triggerAutoSave();
      }
  }, [tasks, triggerAutoSave, initialTasks]);

  // Task Handlers
  const addTask = (text: string) => {
      if (!text.trim()) return;
      const newTasks = [...tasks, { id: uuidv4(), text, isCompleted: false }];
      setTasks(newTasks);
  };

  const toggleTask = (id: string) => {
      const newTasks = tasks.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t);
      setTasks(newTasks);
  };

  const deleteTask = (id: string) => {
      const newTasks = tasks.filter(t => t.id !== id);
      setTasks(newTasks);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
      setSyncStatus('SYNCING');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
          if(editorRef.current) performSave(e.target.value, editorRef.current.innerHTML, tasks, tags);
      }, 800);
  };

  // Observer for Content Changes & Selection
  useEffect(() => {
    const handleMutation = () => {
      if (!editorRef.current) return;
      updateStatsAndFormats();
      setSyncStatus('SYNCING');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
          if (editorRef.current) performSave(title, editorRef.current.innerHTML, tasks, tags);
      }, 800);
    };

    const handleSelectionChange = () => {
        updateStatsAndFormats();
    };

    const observer = new MutationObserver(handleMutation);
    if (editorRef.current) {
        observer.observe(editorRef.current, { childList: true, characterData: true, subtree: true });
    }

    const el = editorRef.current;
    if (el) {
        el.addEventListener('input', handleMutation);
        el.addEventListener('keyup', updateStatsAndFormats);
        el.addEventListener('mouseup', updateStatsAndFormats);
        el.addEventListener('click', updateStatsAndFormats);
        document.addEventListener('selectionchange', handleSelectionChange);
    }

    return () => {
      observer.disconnect();
      if (el) {
          el.removeEventListener('input', handleMutation);
          el.removeEventListener('keyup', updateStatsAndFormats);
          el.removeEventListener('mouseup', updateStatsAndFormats);
          el.removeEventListener('click', updateStatsAndFormats);
          document.removeEventListener('selectionchange', handleSelectionChange);
      }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [performSave, updateStatsAndFormats, title, tasks, tags]); 

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (isReadonly) return;
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
    updateStatsAndFormats(); 
  };

  const changeFont = (fontValue: string) => {
      if(isReadonly) return;
      setCurrentFont(fontValue);
      document.execCommand('fontName', false, fontValue);
      if (editorRef.current) editorRef.current.style.fontFamily = fontValue;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isReadonly) return;

    if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        switch (key) {
            case 'b': e.preventDefault(); executeCommand('bold'); break;
            case 'i': e.preventDefault(); executeCommand('italic'); break;
            case 'u': e.preventDefault(); executeCommand('underline'); break;
            case 'z': e.preventDefault(); executeCommand('undo'); break;
            case 'y': e.preventDefault(); executeCommand('redo'); break;
            default: break;
        }
    }
  };

  // ... (Hanisah AI Logic preserved) ...
  const openHanisahWriter = () => {
      if (isReadonly) return;
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          const text = selection.toString();
          const range = selection.getRangeAt(0);
          setSelectedText(text);
          setSelectionRange(range);
      } else {
          setSelectedText('');
          setSelectionRange(null);
      }
      setHanisahResult(null);
      setHanisahInstruction('');
      setShowHanisahOverlay(true);
  };

  const handleHanisahProcess = async (instructionOverride?: string) => {
    const finalInstruction = instructionOverride || hanisahInstruction;
    if (!finalInstruction.trim() || isHanisahProcessing) return;
    setIsHanisahProcessing(true);
    setHanisahResult(null);
    try {
      const contextText = selectedText || editorRef.current?.innerText || "";
      const contextLabel = selectedText ? "SELECTED_TEXT" : "FULL_DOCUMENT";
      const prompt = `[ROLE: HANISAH_WRITER_MODULE] TASK: ${finalInstruction} CONTEXT (${contextLabel}): """${contextText}""" OUTPUT_DIRECTIVE: Return ONLY the revised/generated text. LANGUAGE_TARGET: ${TRANSLATIONS[currentLang].meta.label}`;
      const response = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview', "Writer Assistant");
      setHanisahResult(response.text || "Output generation failed.");
    } catch (error) {
      setHanisahResult("Neural processing error.");
    } finally {
      setIsHanisahProcessing(false);
    }
  };

  const applyHanisahResult = (mode: 'REPLACE' | 'INSERT' = 'REPLACE') => {
    if (!hanisahResult || !editorRef.current) return;
    editorRef.current.focus();
    if (selectionRange && selectedText) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(selectionRange);
        if (mode === 'REPLACE') document.execCommand('insertHTML', false, hanisahResult.replace(/\n/g, '<br>'));
        else { selectionRange.collapse(false); document.execCommand('insertHTML', false, " " + hanisahResult.replace(/\n/g, '<br>')); }
    } else {
        if (mode === 'REPLACE') { const formatted = hanisahResult.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join(''); editorRef.current.innerHTML = formatted; }
        else document.execCommand('insertHTML', false, `<br>${hanisahResult.replace(/\n/g, '<br>')}`);
    }
    triggerAutoSave();
    updateStatsAndFormats();
    setShowHanisahOverlay(false);
    setHanisahResult(null);
    setHanisahInstruction('');
    setSelectedText('');
    setSelectionRange(null);
  };

  const toggleDictation = () => {
    if (isReadonly) return;
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { 
        alert("Browser ini tidak mendukung dikte suara."); 
        return; 
    }

    const r = new SpeechRecognition();
    
    // Dynamic Language Setting based on i18n
    r.lang = TRANSLATIONS[currentLang].meta.code;
    
    r.continuous = true; 
    r.interimResults = true; 

    r.onstart = () => setIsDictating(true);
    r.onend = () => setIsDictating(false);
    r.onerror = (e: any) => {
        console.error("Dictation Error:", e);
        setIsDictating(false);
    };

    r.onresult = (e: any) => {
      const result = e.results[e.results.length - 1];
      const text = result[0].transcript;
      
      if (result.isFinal) {
          if (editorRef.current) {
              editorRef.current.focus();
              document.execCommand('insertText', false, text + ' ');
          }
      }
    };

    recognitionRef.current = r;
    r.start();
  };

  return (
    <div className={`flex flex-col h-full bg-skin-card ${isFocusMode ? 'fixed inset-0 z-[1500] p-0' : 'relative rounded-[32px] overflow-hidden'}`}>
      
      {/* 1. HEADER (Navigation) */}
      <div className="sticky top-0 z-[100] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] bg-skin-card/80 backdrop-blur-xl border-b border-skin-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
              <button 
                  onClick={onBack}
                  className="w-10 h-10 rounded-full bg-skin-surface hover:bg-skin-surface-hover flex items-center justify-center text-skin-muted transition-all active:scale-95 shrink-0"
                  aria-label="Back to Notes"
              >
                  <ArrowLeft size={18} strokeWidth={2.5} />
              </button>
              
              {/* Status Indicator */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${syncStatus === 'SYNCING' ? 'border-accent/30 text-accent bg-accent/5' : 'border-skin-border text-skin-muted bg-skin-surface'}`}>
                  {syncStatus === 'SYNCING' ? <RefreshCw size={10} className="animate-spin"/> : <Check size={10}/>}
                  {syncStatus === 'SAVED' ? t.saved : t.save}
              </div>
          </div>

          <div className="flex items-center gap-2">
             <button 
                onClick={onDelete}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-500/20"
                title="Delete Note"
             >
                 <Trash2 size={16} />
             </button>

             <button 
                onClick={() => setIsTaskPanelOpen(!isTaskPanelOpen)}
                className={`relative px-4 py-2 rounded-full flex items-center gap-2 transition-all text-[10px] font-black uppercase tracking-widest border active:scale-95 ${isTaskPanelOpen ? 'bg-blue-500 text-white border-blue-600' : 'bg-transparent border-skin-border text-skin-muted hover:text-skin-text'}`}
                title="Tasks"
             >
                 <CheckSquare size={14} />
                 {t.tasks.split(' ')[0]}
                 {tasks.length > 0 && (
                     <div className="flex items-center gap-1 ml-1 bg-skin-surface-hover px-1.5 rounded-md">
                        <span className="text-[9px]">{tasks.filter(t => !t.isCompleted).length}</span>
                     </div>
                 )}
             </button>

             <button onClick={() => setIsFocusMode(!isFocusMode)} className="w-10 h-10 rounded-full flex items-center justify-center text-skin-muted hover:bg-skin-surface transition-all" title="Toggle Focus">
                 {isFocusMode ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
             </button>
          </div>
      </div>

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scroll px-6 md:px-12 lg:px-24 pt-8 pb-32">
          <div className="max-w-3xl mx-auto relative flex flex-col h-full">
              
              {/* TITLE & METADATA */}
              <div className="mb-6 group shrink-0">
                  <input 
                    type="text" 
                    value={title}
                    onChange={handleTitleChange}
                    readOnly={isReadonly}
                    placeholder="Untitled Note"
                    className="w-full bg-transparent text-4xl md:text-5xl font-black tracking-tight text-skin-text placeholder:text-skin-muted outline-none border-none p-0 leading-tight"
                  />
                  <div className="flex items-center gap-4 mt-4 text-[9px] tech-mono font-bold text-skin-muted uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center gap-1"><Clock size={10}/> {readTime} MIN</span>
                        <span className="w-1 h-1 rounded-full bg-skin-border"></span>
                        <span>{wordCount} WORDS</span>
                        <span className="w-1 h-1 rounded-full bg-skin-border"></span>
                        <span>{new Date().toLocaleDateString()}</span>
                  </div>
              </div>

              {/* TOOLBAR */}
              <div className="sticky top-0 z-40 py-3 mb-6 bg-skin-card/95 backdrop-blur-md -mx-4 px-4 transition-all border-b border-skin-border shadow-sm">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar relative">
                        {/* History */}
                        <div className="flex items-center gap-0.5 px-1 border-r border-skin-border pr-2 mr-1 shrink-0">
                            <ToolbarButton onClick={() => executeCommand('undo')} icon={<Undo size={16} />} ariaLabel="Undo" className="w-9 h-9 rounded-xl" />
                            <ToolbarButton onClick={() => executeCommand('redo')} icon={<Redo size={16} />} ariaLabel="Redo" className="w-9 h-9 rounded-xl" />
                        </div>

                        {/* Formatting Groups */}
                        <div className="flex items-center gap-0.5 px-1 border-r border-skin-border pr-2 mr-1 shrink-0">
                            <ToolbarButton onClick={() => executeCommand('bold')} icon={<Bold size={16} />} isActive={formats.bold} ariaLabel="Bold" className="w-9 h-9 rounded-xl" />
                            <ToolbarButton onClick={() => executeCommand('italic')} icon={<Italic size={16} />} isActive={formats.italic} ariaLabel="Italic" className="w-9 h-9 rounded-xl" />
                            <ToolbarButton onClick={() => executeCommand('underline')} icon={<Underline size={16} />} isActive={formats.underline} ariaLabel="Underline" className="w-9 h-9 rounded-xl" />
                        </div>

                        <div className="flex items-center gap-2 pl-1 ml-auto shrink-0">
                            <button 
                                onClick={toggleDictation}
                                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                                    isDictating 
                                    ? 'bg-red-500 text-white shadow-lg animate-pulse' 
                                    : 'bg-skin-surface text-skin-muted hover:text-skin-text hover:bg-skin-surface-hover'
                                }`}
                                title={t.dictate}
                            >
                                {isDictating ? <MicOff size={16} /> : <Mic size={16} />}
                            </button>

                            <button 
                                onClick={openHanisahWriter} 
                                disabled={isReadonly}
                                className="flex items-center justify-center gap-2 px-4 h-9 bg-skin-text text-skin-card rounded-xl transition-all active:scale-95 hover:shadow-lg hover:scale-105 group"
                                title={t.magic}
                            >
                                <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
                                <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">MAGIC</span>
                            </button>
                        </div>
                  </div>
              </div>

              {/* EDITOR */}
              <div 
                ref={editorRef}
                contentEditable={!isReadonly}
                suppressContentEditableWarning
                onKeyDown={handleKeyDown}
                className={`
                    min-h-[50vh] flex-1 w-full outline-none text-skin-text selection:bg-accent/20 
                    max-w-none prose dark:prose-invert prose-lg
                    prose-p:leading-loose prose-p:my-4 
                    prose-headings:font-black prose-headings:tracking-tight prose-headings:mb-4 prose-headings:mt-8
                    prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4 prose-li:my-1
                    prose-pre:bg-skin-surface prose-pre:text-sm prose-pre:p-6 prose-pre:rounded-2xl prose-pre:font-mono prose-pre:border prose-pre:border-skin-border
                    prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:pl-4 prose-blockquote:italic
                    ${isReadonly ? 'cursor-default' : 'cursor-text'}
                `}
                style={{ fontSize: `${fontSize}px`, fontFamily: currentFont }}
                data-placeholder={t.placeholder}
              />
          </div>
      </div>

      {/* TASK PANEL (Sidebar) */}
      <div className={`
          absolute top-0 right-0 bottom-0 w-[85%] md:w-80 bg-skin-card/95 backdrop-blur-xl border-l border-skin-border 
          transform transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] z-50 flex flex-col shadow-2xl
          ${isTaskPanelOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
          <div className="p-5 border-b border-skin-border flex items-center justify-between bg-skin-surface/50">
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <CheckSquare size={16} />
                  </div>
                  <div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">{t.tasks}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                          <div className="w-16 h-1 bg-skin-surface-hover rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${taskProgress}%` }}></div>
                          </div>
                          <span className="text-[8px] font-mono text-skin-muted">{Math.round(taskProgress)}%</span>
                      </div>
                  </div>
              </div>
              <button onClick={() => setIsTaskPanelOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-skin-surface-hover text-skin-muted transition-all"><X size={18}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scroll">
              {tasks.map(task => (
                  <div key={task.id} className={`group flex items-start gap-3 p-3 rounded-xl border transition-all ${task.isCompleted ? 'bg-skin-surface border-transparent opacity-60' : 'bg-skin-card border-skin-border hover:border-blue-500/30'}`}>
                      <button 
                        onClick={() => !isReadonly && toggleTask(task.id)}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${task.isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 'border-neutral-300 dark:border-white/20 hover:border-blue-500'}`}
                      >
                          {task.isCompleted && <Check size={12} strokeWidth={3} />}
                      </button>
                      <span className={`text-xs font-medium leading-relaxed flex-1 break-words ${task.isCompleted ? 'text-skin-muted line-through decoration-neutral-300' : 'text-skin-text'}`}>
                          {task.text}
                      </span>
                      {!isReadonly && (
                          <button 
                            onClick={() => deleteTask(task.id)} 
                            className="w-6 h-6 flex items-center justify-center text-skin-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Task"
                          >
                              <Trash2 size={12} />
                          </button>
                      )}
                  </div>
              ))}
              {tasks.length === 0 && <div className="text-center py-10 text-[10px] font-black text-skin-muted uppercase tracking-widest opacity-50">NO_TASKS_LINKED</div>}
          </div>

          {!isReadonly && (
              <div className="p-4 border-t border-skin-border bg-skin-surface/50">
                  <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        const input = (e.target as any).taskInput;
                        addTask(input.value);
                        input.value = '';
                    }}
                    className="flex gap-2"
                  >
                      <input 
                        name="taskInput"
                        placeholder="Add new task..."
                        className="flex-1 bg-skin-surface border border-skin-border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition-all"
                        autoComplete="off"
                      />
                      <button type="submit" className="w-10 flex items-center justify-center bg-skin-text text-skin-card rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg">
                          <Plus size={18} />
                      </button>
                  </form>
              </div>
          )}
      </div>

      {/* Hanisah Writer Overlay - UI remains consistent with editor */}
      {showHanisahOverlay && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
            <div className="w-full max-w-4xl bg-skin-card rounded-[32px] border border-skin-border overflow-hidden shadow-2xl flex flex-col md:flex-row h-[85vh] md:h-[600px] ring-1 ring-skin-border">
                <div className="w-full md:w-[400px] flex flex-col border-r border-skin-border bg-skin-surface/50">
                    <div className="p-6 border-b border-skin-border flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20"><Flame size={20} /></div>
                            <div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-skin-text">HANISAH_WRITER</h3><p className="text-[9px] text-skin-muted font-mono uppercase tracking-widest mt-0.5">NEURAL EDITING MODULE</p></div>
                        </div>
                        <button onClick={() => setShowHanisahOverlay(false)} className="w-8 h-8 rounded-full hover:bg-skin-surface-hover flex items-center justify-center text-skin-muted transition-all"><X size={18}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-6">
                         <div className="space-y-3">
                            <label className="text-[9px] font-black text-skin-muted uppercase tracking-[0.2em] pl-1">QUICK_PROTOCOLS</label>
                            <div className="grid grid-cols-2 gap-2">
                                {WRITER_PRESETS.map(preset => (
                                    <button key={preset.id} onClick={() => handleHanisahProcess(preset.prompt)} disabled={isHanisahProcessing} className="p-3 rounded-xl bg-skin-card border border-skin-border hover:border-orange-500/30 hover:bg-orange-500/5 transition-all text-left group">
                                        <div className="flex items-center gap-2 text-skin-muted group-hover:text-orange-500 mb-1">{preset.icon}<span className="text-[9px] font-black uppercase tracking-widest">{preset.label}</span></div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[9px] font-black text-skin-muted uppercase tracking-[0.2em] pl-1">CUSTOM_DIRECTIVE</label>
                            <textarea value={hanisahInstruction} onChange={(e) => setHanisahInstruction(e.target.value)} className="w-full h-24 bg-skin-card rounded-xl p-4 text-xs font-medium border border-skin-border focus:outline-none focus:border-orange-500/50 resize-none transition-all placeholder:text-skin-muted" placeholder="E.g., Rewrite this to be funnier..." />
                            <button onClick={() => handleHanisahProcess()} disabled={!hanisahInstruction || isHanisahProcessing} className="w-full py-4 bg-skin-text text-skin-card rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                                {isHanisahProcessing ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />} {isHanisahProcessing ? 'SYNTHESIZING...' : 'EXECUTE'}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex-1 bg-skin-surface flex flex-col overflow-hidden relative">
                    <div className="h-14 border-b border-skin-border flex items-center justify-between px-6 bg-skin-card">
                        <span className="text-[9px] font-black text-skin-muted uppercase tracking-[0.2em]">RESULT_MATRIX</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8">
                        {hanisahResult ? <div className="prose dark:prose-invert prose-sm max-w-none text-skin-text leading-relaxed bg-skin-card p-6 rounded-2xl border border-skin-border shadow-sm" dangerouslySetInnerHTML={{ __html: hanisahResult.replace(/\n/g, '<br/>') }} /> : <div className="h-full flex flex-col items-center justify-center opacity-30 text-center gap-4"><Sparkles size={48} strokeWidth={1} /><p className="text-[10px] font-black uppercase tracking-[0.3em]">AWAITING_INSTRUCTION</p></div>}
                    </div>
                    {hanisahResult && <div className="p-4 border-t border-skin-border bg-skin-card flex gap-3">
                        <button onClick={() => applyHanisahResult('INSERT')} className="flex-1 py-3 bg-skin-surface hover:bg-skin-surface-hover text-skin-text rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">INSERT BELOW</button>
                        <button onClick={() => applyHanisahResult('REPLACE')} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md">REPLACE SELECTION</button>
                    </div>}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};