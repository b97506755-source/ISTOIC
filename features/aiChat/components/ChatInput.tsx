
import React, { useRef, useEffect, useState, memo } from 'react';
import { Send, Plus, Loader2, Mic, MicOff, Database, DatabaseZap, Paperclip, X, Image as ImageIcon, Flame, Brain, CornerDownLeft, Clipboard, ShieldCheck, FileText, Square, Globe, Palette } from 'lucide-react';
import { TRANSLATIONS, getLang } from '../../../services/i18n';
import { debugService } from '../../../services/debugService';
import { UI_REGISTRY, FN_REGISTRY } from '../../../constants/registry';

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  onSubmit: (e?: React.FormEvent, attachment?: { data: string, mimeType: string }) => void;
  onStop?: () => void;
  onNewChat: () => void;
  onFocusChange: (isFocused: boolean) => void;
  aiName: string;
  isVaultSynced?: boolean;
  onToggleVaultSync?: () => void;
  personaMode?: 'hanisah' | 'stoic';
  isVaultEnabled?: boolean;
  onTogglePersona?: () => void;
  variant?: 'hero' | 'standard';
  onPollinations?: () => void; 
  disableVisuals?: boolean;
}

const MAX_CHARS = 4000;

export const ChatInput: React.FC<ChatInputProps> = memo(({
  input,
  setInput,
  isLoading,
  onSubmit,
  onStop,
  onNewChat,
  onFocusChange,
  aiName,
  isVaultSynced = true,
  onToggleVaultSync,
  personaMode = 'hanisah',
  isVaultEnabled = true,
  onTogglePersona,
  variant = 'standard',
  onPollinations,
  disableVisuals = false
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File, preview: string, base64: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const currentLang = getLang();
  const t = TRANSLATIONS[currentLang].chat;

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const newHeight = Math.min(inputRef.current.scrollHeight, 150);
      inputRef.current.style.height = `${Math.max(24, newHeight)}px`;
    }
  }, [input, attachment]);

  // Cleanup dictation on unmount
  useEffect(() => {
      return () => {
          if (recognitionRef.current) recognitionRef.current.stop();
      };
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
      
      setPasteFlash(true);
      setTimeout(() => setPasteFlash(false), 500);
  };

  const toggleDictation = (e: React.MouseEvent) => {
    e.stopPropagation();
    debugService.logAction(UI_REGISTRY.CHAT_INPUT_MIC, FN_REGISTRY.CHAT_SEND_MESSAGE, isDictating ? 'STOP' : 'START');
    
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    // BROWSER COMPATIBILITY CHECK
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Fitur ini membutuhkan Google Chrome, Edge, atau Safari terbaru. Browser Anda tidak mendukung Web Speech API.");
      return;
    }

    try {
        const recognition = new SpeechRecognition();
        recognition.lang = TRANSLATIONS[currentLang].meta.code;
        recognition.continuous = true;
        recognition.interimResults = true; 

        recognition.onstart = () => {
            setIsDictating(true);
            if (navigator.vibrate) navigator.vibrate(50); 
        };
        
        recognition.onend = () => {
            setIsDictating(false);
        };
        
        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
              setInput((prev) => {
                  const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                  return prev + (needsSpace ? ' ' : '') + finalTranscript;
              });
          }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsDictating(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    } catch (err) {
        console.error("Mic initialization failed", err);
        alert("Gagal memulai mikrofon. Pastikan izin telah diberikan.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) handleSubmit();
    }
  };

  const processFile = (file: File) => {
      if (!file.type.startsWith('image/')) {
          alert("Only images supported.");
          return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64 = result.split(',')[1];
          setAttachment({ file, preview: result, base64 });
      };
      reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) processFile(e.target.files[0]);
      e.target.value = '';
  };

  const handleAttachClick = () => {
      if (disableVisuals) return;
      debugService.logAction(UI_REGISTRY.CHAT_INPUT_ATTACH, FN_REGISTRY.CHAT_SEND_MESSAGE, 'OPEN_DIALOG');
      fileInputRef.current?.click();
  };

  const handleNewChatClick = () => {
      debugService.logAction(UI_REGISTRY.CHAT_INPUT_NEW, FN_REGISTRY.CHAT_NEW_SESSION, 'CLICK');
      onNewChat();
  };

  const handleStop = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onStop) onStop();
  };

  const handleSubmit = () => {
      if (isDictating) {
          recognitionRef.current?.stop();
          setIsDictating(false);
      }
      if ((!input.trim() && !attachment) || isLoading) return;
      if (input.length > MAX_CHARS) {
          alert(`Character limit exceeded (${MAX_CHARS}). Please shorten your message.`);
          return;
      }

      debugService.logAction(UI_REGISTRY.CHAT_INPUT_SEND, FN_REGISTRY.CHAT_SEND_MESSAGE, 'SUBMIT');

      const attachmentPayload = attachment ? { data: attachment.base64, mimeType: attachment.file.type } : undefined;
      onSubmit(undefined, attachmentPayload);
      setAttachment(null);
      // Reset height
      if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const charCountColor = input.length > MAX_CHARS * 0.9 
      ? 'text-red-500' 
      : input.length > MAX_CHARS * 0.7 
          ? 'text-amber-500' 
          : 'text-neutral-400';

  const accentColor = personaMode === 'hanisah' ? 'border-orange-500/50' : 'border-cyan-500/50';
  const ringColor = personaMode === 'hanisah' ? 'ring-orange-500/20' : 'ring-cyan-500/20';

  return (
    <div className="w-full relative group">
      
      {/* Dictation Overlay Indicator */}
      {isDictating && (
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in z-20 pointer-events-none">
              <div className="bg-red-500/90 backdrop-blur-md text-white px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-[0_0_30px_rgba(239,68,68,0.4)] border border-red-400">
                  <div className="flex gap-1 items-center h-3">
                      <div className="w-1 bg-white animate-[music-bar_0.8s_ease-in-out_infinite]"></div>
                      <div className="w-1 bg-white animate-[music-bar_0.6s_ease-in-out_infinite]"></div>
                      <div className="w-1 bg-white animate-[music-bar_1.0s_ease-in-out_infinite]"></div>
                  </div>
                  {t.listening}
              </div>
          </div>
      )}

      {/* Paste Flash Indicator */}
      {pasteFlash && (
          <div className="absolute -top-10 right-0 text-[9px] font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg animate-fade-in flex items-center gap-2 backdrop-blur-sm">
              <Clipboard size={12} /> FORMAT_STRIPPED
          </div>
      )}

      {/* MAIN CAPSULE - GLASS HUD STYLE */}
      <div 
        className={`
            w-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
            bg-white/80 dark:bg-[#0f0f11]/80 backdrop-blur-xl
            border 
            rounded-[36px] p-2 flex flex-col
            shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)]
            ${isDictating 
                ? 'border-red-500/50 ring-4 ring-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.2)]' 
                : pasteFlash
                    ? 'border-emerald-500/50 ring-4 ring-emerald-500/10'
                    : isFocused || isDragOver 
                        ? `${accentColor} ring-4 ${ringColor} shadow-[0_0_40px_rgba(var(--accent-rgb),0.1)] scale-[1.01]` 
                        : 'border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/20'
            }
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if(e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]); }}
      >
        
        {/* Attachment Preview Area */}
        {attachment && (
            <div className="px-4 pt-4 pb-2 flex animate-slide-up">
                <div className="relative group/preview inline-block">
                    <img src={attachment.preview} alt="Preview" className="h-20 w-auto rounded-2xl border border-black/10 dark:border-white/10 shadow-lg object-cover ring-1 ring-white/10" />
                    <button 
                        onClick={() => setAttachment(null)}
                        aria-label="Remove Attachment"
                        className="absolute -top-2 -right-2 bg-black/80 backdrop-blur text-white rounded-full p-1.5 shadow-md hover:bg-red-500 transition-colors border border-white/20 active:scale-90"
                    >
                        <X size={10} />
                    </button>
                </div>
            </div>
        )}

        {/* INPUT AREA */}
        <div className="relative px-4 pt-3 pb-2 flex items-center">
            <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onFocus={() => { setIsFocused(true); onFocusChange(true); }}
                onBlur={() => { setIsFocused(false); onFocusChange(false); }}
                placeholder={isDictating ? "" : (personaMode === 'hanisah' ? "Chat with Hanisah..." : "Query Stoic Logic...")}
                className="w-full bg-transparent text-base md:text-[15px] font-medium text-black dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 resize-none focus:outline-none max-h-60 custom-scroll leading-relaxed"
                rows={1}
                aria-label="Chat Input"
                disabled={isLoading && !onStop} 
            />
        </div>

        {/* TOOLBAR & ACTIONS */}
        <div className="flex items-center justify-between px-3 pb-1.5 gap-2 border-t border-transparent transition-colors duration-300 mt-1">
            
            {/* Left Tools */}
            <div className="flex gap-2 items-center">
                <button 
                    onClick={handleNewChatClick}
                    aria-label="New Chat"
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5 text-neutral-500 hover:text-black dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-all active:scale-95 border border-transparent hover:border-black/5 dark:hover:border-white/5"
                    title={t.newChat}
                >
                    <Plus size={18} strokeWidth={2.5} />
                </button>
                
                <button 
                    onClick={handleAttachClick}
                    disabled={disableVisuals}
                    aria-label="Attach Image"
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95 border 
                        ${disableVisuals 
                            ? 'opacity-30 cursor-not-allowed text-neutral-500 bg-transparent' 
                            : attachment 
                                ? 'text-accent bg-accent/10 border-accent/20' 
                                : 'bg-zinc-100 dark:bg-white/5 border-transparent text-neutral-500 hover:text-blue-500 hover:bg-blue-500/10'
                        }`}
                    title={disableVisuals ? "Visuals Disabled" : "Attach Image"}
                >
                    <Paperclip size={18} strokeWidth={2.5} />
                </button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*" />

                {/* Pollinations.ai Flux Trigger */}
                <button 
                    onClick={() => !disableVisuals && onPollinations && onPollinations()}
                    disabled={disableVisuals}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95 border 
                        ${disableVisuals 
                            ? 'opacity-30 cursor-not-allowed text-neutral-500 bg-transparent'
                            : 'bg-zinc-100 dark:bg-white/5 text-neutral-500 hover:text-pink-500 hover:bg-pink-500/10 border-transparent hover:border-pink-500/20'
                        }`}
                    title={disableVisuals ? "Visuals Disabled" : "Generate with Flux"}
                >
                    <Palette size={18} strokeWidth={2.5} />
                </button>

                <button 
                    onClick={onToggleVaultSync}
                    disabled={!isVaultEnabled}
                    aria-label={isVaultEnabled ? (isVaultSynced ? "Vault Sync Active" : "Vault Sync Inactive") : "Vault Disabled"}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95 border ${!isVaultEnabled ? 'opacity-30' : isVaultSynced ? 'text-purple-500 bg-purple-500/10 border-purple-500/20' : 'bg-zinc-100 dark:bg-white/5 border-transparent text-neutral-500 hover:text-purple-500 hover:bg-purple-500/10'}`}
                    title={isVaultEnabled ? "Vault Sync" : "Vault Disabled"}
                >
                    {isVaultSynced ? <DatabaseZap size={18} strokeWidth={2.5} /> : <Database size={18} strokeWidth={2.5} />}
                </button>
            </div>

            {/* Right Actions & Status */}
            <div className="flex items-center gap-3">
                {/* Character Counter */}
                <div className={`text-[9px] tech-mono font-bold transition-colors ${charCountColor} hidden sm:block ${input.length > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    {input.length} <span className="opacity-40">/ {MAX_CHARS}</span>
                </div>

                {/* Dictation */}
                <button 
                    onClick={toggleDictation}
                    aria-label={isDictating ? "Stop Dictation" : "Start Dictation"}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95 border ${isDictating ? 'bg-red-500 border-red-500 text-white shadow-lg animate-pulse' : 'bg-zinc-100 dark:bg-white/5 border-transparent text-neutral-500 hover:text-red-500 hover:bg-red-500/10'}`}
                    title="Real-time Dictation"
                >
                    {isDictating ? <MicOff size={18} strokeWidth={2.5} /> : <Mic size={20} strokeWidth={2} />}
                </button>

                {/* Send / Stop Button */}
                {isLoading ? (
                    <button 
                        onClick={handleStop}
                        aria-label="Stop Generation"
                        className="w-14 h-14 rounded-[22px] flex items-center justify-center transition-all duration-300 bg-red-500 text-white shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95 hover:shadow-red-500/50 animate-pulse border border-red-400"
                        title="Stop Generation"
                    >
                        <Square size={20} fill="currentColor" />
                    </button>
                ) : (
                    <button 
                        onClick={() => handleSubmit()}
                        disabled={(!input.trim() && !attachment) || input.length > MAX_CHARS}
                        aria-label="Send Message"
                        className={`
                            w-14 h-14 rounded-[22px] flex items-center justify-center transition-all duration-300 border
                            ${(input.trim() || attachment) && input.length <= MAX_CHARS
                                ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg hover:scale-105 active:scale-95 hover:shadow-[0_0_30px_var(--accent-glow)] border-transparent' 
                                : 'bg-zinc-100 dark:bg-white/5 text-neutral-300 dark:text-neutral-600 cursor-not-allowed border-transparent'}
                        `}
                    >
                        <CornerDownLeft size={24} strokeWidth={3} />
                    </button>
                )}
            </div>
        </div>
      </div>
      
      <style>{`
        @keyframes music-bar {
            0%, 100% { height: 4px; }
            50% { height: 12px; }
        }
      `}</style>
    </div>
  );
});
