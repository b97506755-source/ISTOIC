
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { type Note } from '../../types';
import useLocalStorage from '../../hooks/useLocalStorage';
import { 
  Radio, ChevronDown, Flame, Brain, ArrowRight, Palette, Code, 
  GraduationCap, Lightbulb, History, Layers, Infinity, ArrowDown,
  Terminal, Sparkles as SparklesIcon, Command, Zap, Image as ImageIcon, Lock
} from 'lucide-react';

import { useLiveSession } from '../../contexts/LiveSessionContext';
import { ChatHistory } from './components/ChatHistory';
import { ModelPicker } from './components/ModelPicker';
import { ImageModelPicker } from './components/ImageModelPicker';
import { NeuralLinkOverlay } from './components/NeuralLinkOverlay';
import { ChatInput } from './components/ChatInput'; 
import { ChatWindow } from './components/ChatWindow'; 
import { VaultPinModal } from '../../components/VaultPinModal';
import { useNavigationIntelligence } from '../../hooks/useNavigationIntelligence';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { debugService } from '../../services/debugService';
import { useFeatures } from '../../contexts/FeatureContext';

interface AIChatViewProps {
    chatLogic: any;
}

// ... (PersonaToggle & SuggestionCard components remain SAME)
const PersonaToggle: React.FC<{ 
    mode: 'hanisah' | 'stoic'; 
    onToggle: () => void;
}> = ({ mode, onToggle }) => {
    return (
        <button 
            onClick={onToggle}
            className={`
                group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300
                ${mode === 'hanisah' 
                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-500' 
                    : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-500'
                }
            `}
        >
            <div className={`w-1.5 h-1.5 rounded-full ${mode === 'hanisah' ? 'bg-orange-500' : 'bg-cyan-500'} animate-pulse`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest">
                {mode === 'hanisah' ? 'HANISAH' : 'STOIC'}
            </span>
            <div className="w-[1px] h-3 bg-current opacity-20 mx-1"></div>
            {mode === 'hanisah' ? <Flame size={12} strokeWidth={2.5} /> : <Brain size={12} strokeWidth={2.5} />}
        </button>
    );
};

const SuggestionCard: React.FC<{ 
    icon: React.ReactNode, 
    label: string, 
    desc: string, 
    onClick: () => void, 
    accent?: string, 
    delay?: number
}> = ({ icon, label, desc, onClick, accent = "text-neutral-400 group-hover:text-accent", delay = 0 }) => (
    <button 
        onClick={onClick}
        style={{ animationDelay: `${delay}ms` }}
        className={`
            relative overflow-hidden group 
            bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm
            border border-black/5 dark:border-white/5
            rounded-[20px] p-4 text-left 
            transition-all duration-300 ease-out
            hover:bg-white dark:hover:bg-white/[0.08]
            hover:border-accent/20 hover:shadow-lg
            hover:-translate-y-0.5 active:scale-[0.98]
            flex items-center gap-4 h-full
            animate-slide-up
        `}
    >
        <div className={`w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${accent} border border-black/5 dark:border-white/5`}>
            {React.cloneElement(icon as React.ReactElement<any>, { size: 18, strokeWidth: 2 })}
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-300 group-hover:text-black dark:group-hover:text-white transition-colors truncate">{label}</h4>
            <p className="text-[10px] text-neutral-400 font-medium truncate opacity-80 group-hover:opacity-100 transition-opacity">{desc}</p>
        </div>
        <ArrowRight size={14} className="text-neutral-300 dark:text-neutral-600 -rotate-45 group-hover:rotate-0 group-hover:text-accent transition-all duration-300" />
    </button>
);

const AIChatView: React.FC<AIChatViewProps> = ({ chatLogic }) => {
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [showImagePicker, setShowImagePicker] = useState(false);
    const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false); 
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    
    const { isFeatureEnabled } = useFeatures();
    const isLiveLinkEnabled = isFeatureEnabled('LIVE_LINK');
    
    const { shouldShowNav } = useNavigationIntelligence();
    const isMobileNavVisible = shouldShowNav && window.innerWidth < 768; 
    
    const {
        threads, setThreads,
        activeThread, activeThreadId, setActiveThreadId,
        input, setInput,
        isLoading,
        activeModel,
        personaMode,
        handleNewChat,
        sendMessage,
        stopGeneration, 
        togglePinThread,
        deleteThread, // UPDATED: Destructure deleteThread
        renameThread,
        isVaultSynced,
        setIsVaultSynced,
        isVaultConfigEnabled, 
        setIsLiveModeActive,
        setGlobalModelId,
        generateWithPollinations,
        imageModelId,
        setImageModelId
    } = chatLogic;

    // ... (Refs and Effects same as before) ...
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isAutoScrolling = useRef(true);

    const isStoic = personaMode === 'stoic';

    const {
        isLive,
        isMinimized,
        status: liveStatus,
        transcript: transcriptHistory,
        interimTranscript,
        startSession,
        stopSession,
        toggleMinimize,
        analyser,
        activeTool 
    } = useLiveSession();

    useEffect(() => {
        if (setIsLiveModeActive) setIsLiveModeActive(isLive);
    }, [isLive, setIsLiveModeActive]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
            isAutoScrolling.current = true;
            setShowScrollBtn(false);
        }
    }, []);

    useEffect(() => {
        const container = document.getElementById('main-scroll-container');
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceToBottom = scrollHeight - scrollTop - clientHeight;
            
            if (distanceToBottom > 300) {
                isAutoScrolling.current = false;
                setShowScrollBtn(true);
            } else {
                isAutoScrolling.current = true;
                setShowScrollBtn(false);
            }
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (isAutoScrolling.current) {
            scrollToBottom(isLoading ? 'auto' : 'smooth');
        }
    }, [activeThread?.messages, isLoading, scrollToBottom]);

    const handleModelPickerOpen = () => {
        debugService.logAction(UI_REGISTRY.CHAT_BTN_MODEL_PICKER, FN_REGISTRY.CHAT_SELECT_MODEL, 'OPEN');
        setShowModelPicker(true);
    };

    const handleHistoryOpen = () => {
        debugService.logAction(UI_REGISTRY.CHAT_BTN_HISTORY, FN_REGISTRY.CHAT_LOAD_HISTORY, 'OPEN');
        setShowHistoryDrawer(true);
    };

    const handleLiveToggle = () => {
        if (!isLiveLinkEnabled) return;
        
        debugService.logAction(UI_REGISTRY.CHAT_BTN_LIVE_TOGGLE, FN_REGISTRY.CHAT_TOGGLE_LIVE, isLive ? 'STOP' : 'START');
        
        if (isLive) {
            stopSession();
        } else {
            startSession(personaMode);
        }
    };

    const handleVaultToggle = useCallback(() => {
        if (!isVaultConfigEnabled || isTransitioning) return;
        if (isVaultSynced) setIsVaultSynced(false);
        else setShowPinModal(true);
    }, [isVaultSynced, isTransitioning, setIsVaultSynced, isVaultConfigEnabled]);

    const handleUpdateMessage = useCallback((messageId: string, newText: string) => {
        setThreads((prev: any[]) => prev.map((t: any) => {
            if (t.id === activeThreadId) {
                return {
                    ...t,
                    messages: t.messages.map((m: any) => m.id === messageId ? { ...m, text: newText } : m),
                    updated: new Date().toISOString()
                };
            }
            return t;
        }));
    }, [activeThreadId, setThreads]);

    const changePersona = async () => {
        const target = personaMode === 'hanisah' ? 'stoic' : 'hanisah';
        setIsTransitioning(true);
        await handleNewChat(target);
        setTimeout(() => setIsTransitioning(false), 300);
    };

    const showEmptyState = !isLoading && (!activeThreadId || !activeThread || activeThread.messages.length <= 1);
    
    const isHydraActive = activeModel?.id === 'auto-best';
    
    const bgGradient = personaMode === 'hanisah' 
        ? 'bg-gradient-to-b from-orange-500/[0.03] to-transparent' 
        : 'bg-gradient-to-b from-cyan-500/[0.03] to-transparent';

    return (
        <div className={`min-h-full flex flex-col relative w-full bg-noise animate-fade-in transition-colors duration-1000 ${bgGradient}`}>
            <VaultPinModal 
                isOpen={showPinModal} 
                onClose={() => setShowPinModal(false)} 
                onSuccess={() => setIsVaultSynced(true)} 
            />

            <div className="flex-1 flex flex-col relative z-10 w-full max-w-5xl mx-auto transition-all duration-500 pb-[140px] md:pb-32">
                
                {/* 1. COMPACT HUD HEADER */}
                <div className="sticky top-0 z-40 w-full px-4 pt-safe pb-2 flex justify-center pointer-events-none">
                    <div className={`
                        pointer-events-auto backdrop-blur-2xl border rounded-[20px] p-1.5 flex items-center justify-between gap-1 shadow-sm ring-1 transition-all duration-500 mt-2
                        ${isHydraActive 
                            ? 'bg-black/80 dark:bg-zinc-900/90 border-emerald-500/30 ring-emerald-500/20 shadow-emerald-500/5' 
                            : 'bg-white/80 dark:bg-[#0f0f11]/90 border-black/5 dark:border-white/10 ring-black/5 dark:ring-white/5'
                        }
                    `}>
                        {/* LEFT: Model Picker */}
                        <button 
                            className={`flex items-center gap-2 group py-1.5 px-3 rounded-xl transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 active:scale-95`}
                            onClick={handleModelPickerOpen}
                            title="Switch AI Model"
                        >
                            <div className={`
                                w-5 h-5 rounded-lg flex items-center justify-center shrink-0
                                ${isHydraActive ? 'text-emerald-500' : 'text-neutral-500 group-hover:text-black dark:group-hover:text-white'}
                            `}>
                                {isHydraActive ? <Infinity size={14} className="animate-pulse" /> : <Zap size={14} />}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isHydraActive ? 'text-emerald-500' : 'text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white'}`}>
                                {isHydraActive ? 'HYDRA' : (activeModel?.name?.split(' ')[0] || 'MODEL')}
                            </span>
                        </button>

                        <div className="h-4 w-[1px] bg-black/5 dark:bg-white/10 mx-1"></div>

                        {/* CENTER: Persona Toggle */}
                        <PersonaToggle 
                            mode={personaMode} 
                            onToggle={changePersona} 
                        />

                        <div className="h-4 w-[1px] bg-black/5 dark:bg-white/10 mx-1"></div>

                        {/* RIGHT: Tools */}
                        <div className="flex items-center gap-1">
                            {/* Visual Engine */}
                            <button 
                                onClick={() => !isStoic && setShowImagePicker(true)}
                                disabled={isStoic}
                                className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center active:scale-90 group 
                                    ${isStoic 
                                        ? 'bg-black/5 dark:bg-white/5 text-neutral-500 opacity-50 cursor-not-allowed border border-transparent' 
                                        : (imageModelId !== 'hydra' ? 'text-pink-500 hover:bg-black/5 dark:hover:bg-white/5' : 'text-neutral-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5')
                                    }`}
                                title={isStoic ? "LOGIC CORE LOCK: Visuals Disabled" : "Visual Engine"}
                            >
                                {isStoic ? <Lock size={14} /> : <ImageIcon size={16} strokeWidth={2} />}
                            </button>

                            <button 
                                onClick={handleHistoryOpen}
                                className="w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-black dark:hover:text-white transition-all flex items-center justify-center active:scale-90 group"
                                title="Logs"
                            >
                                <History size={16} strokeWidth={2} />
                            </button>

                            <button 
                                onClick={handleLiveToggle}
                                className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center active:scale-95 ${
                                    !isLiveLinkEnabled 
                                    ? 'opacity-30 cursor-not-allowed text-neutral-600' 
                                    : isLive 
                                        ? 'bg-red-500 text-white shadow-lg animate-pulse' 
                                        : 'text-neutral-400 hover:text-red-500 hover:bg-red-500/10'
                                }`}
                                title={!isLiveLinkEnabled ? "Live Link Disabled" : "Live Voice Mode"}
                                disabled={!isLiveLinkEnabled}
                            >
                                <Radio size={16} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. CHAT AREA */}
                <div className="flex-1 w-full relative min-h-0 flex flex-col px-4 md:px-0 mt-4">
                    {showEmptyState ? (
                        <div className="flex flex-col h-full justify-center items-center w-full pb-24 animate-fade-in">
                            <div className="text-center mb-10 space-y-4">
                                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-[24px] mb-2 ${personaMode === 'hanisah' ? 'bg-orange-500/10 text-orange-500' : 'bg-cyan-500/10 text-cyan-500'}`}>
                                    {personaMode === 'hanisah' ? <Flame size={32} /> : <Brain size={32} />}
                                </div>
                                <div>
                                    <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter text-black dark:text-white uppercase leading-none">
                                        {personaMode}
                                    </h2>
                                    <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-[0.3em]">
                                        {personaMode === 'hanisah' ? 'HYPER-INTUITIVE PARTNER' : 'QUANTUM LOGIC KERNEL'}
                                    </p>
                                </div>
                            </div>

                            <div className="w-full max-w-2xl mx-auto px-2 md:px-4 animate-slide-up relative z-20" style={{ animationDelay: '100ms' }}>
                                <ChatInput 
                                    input={input}
                                    setInput={setInput}
                                    isLoading={isLoading}
                                    onSubmit={sendMessage}
                                    onStop={stopGeneration}
                                    onNewChat={() => handleNewChat(personaMode)}
                                    onFocusChange={() => {}}
                                    aiName={personaMode.toUpperCase()}
                                    isVaultSynced={isVaultSynced}
                                    onToggleVaultSync={handleVaultToggle}
                                    personaMode={personaMode}
                                    isVaultEnabled={isVaultConfigEnabled}
                                    onTogglePersona={changePersona}
                                    variant="hero"
                                    onPollinations={generateWithPollinations}
                                    disableVisuals={isStoic}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mx-auto px-2 md:px-4 mt-8 opacity-80">
                                {!isStoic ? (
                                    <SuggestionCard 
                                        icon={<SparklesIcon />} 
                                        label="GENERATE VISUAL" 
                                        desc="Create high-fidelity images." 
                                        onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'GEN_IMG'); setInput("Generate a futuristic cyberpunk city with neon lights."); }} 
                                        accent="text-pink-500 group-hover:text-pink-600"
                                        delay={150}
                                    />
                                ) : (
                                    <SuggestionCard 
                                        icon={<Brain />} 
                                        label="FIRST PRINCIPLES" 
                                        desc="Deconstruct complex problems." 
                                        onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'LOGIC'); setInput("Analyze this problem using First Principles thinking: [Insert Problem]"); }} 
                                        accent="text-cyan-500 group-hover:text-cyan-600"
                                        delay={150}
                                    />
                                )}
                                <SuggestionCard 
                                    icon={<Code />} 
                                    label="CODE AUDIT" 
                                    desc="Debug & optimize algorithms." 
                                    onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'CODE_AUDIT'); setInput("Analyze this algorithm for complexity: [Paste Code]"); }} 
                                    accent="text-emerald-500 group-hover:text-emerald-600"
                                    delay={200}
                                />
                            </div>
                        </div>
                    ) : (
                        <ChatWindow 
                            messages={activeThread?.messages || []}
                            personaMode={personaMode}
                            isLoading={isLoading}
                            messagesEndRef={messagesEndRef}
                            onUpdateMessage={handleUpdateMessage}
                        />
                    )}
                </div>

                {!showEmptyState && (
                    <div className={`
                        fixed bottom-0 left-0 right-0 z-[100] 
                        pointer-events-none flex justify-center
                        pb-safe px-4 md:px-0 md:left-[80px]
                        transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                        ${isMobileNavVisible 
                            ? 'mb-[calc(7rem+env(safe-area-inset-bottom))] md:mb-6' 
                            : 'mb-6'
                        }
                        animate-slide-up
                    `}>
                        <div className="w-full max-w-[900px] pointer-events-auto relative">
                            {showScrollBtn && (
                                <button 
                                    onClick={() => scrollToBottom()}
                                    className="absolute -top-16 right-0 z-20 w-10 h-10 rounded-full bg-white dark:bg-[#0a0a0b] shadow-xl border border-black/10 dark:border-white/10 flex items-center justify-center text-accent hover:scale-110 active:scale-95 transition-all animate-bounce"
                                >
                                    <ArrowDown size={18} strokeWidth={2.5} />
                                </button>
                            )}

                            <ChatInput 
                                input={input}
                                setInput={setInput}
                                isLoading={isLoading}
                                onSubmit={sendMessage}
                                onStop={stopGeneration}
                                onNewChat={() => handleNewChat(personaMode)}
                                onFocusChange={() => {}}
                                aiName={personaMode.toUpperCase()}
                                isVaultSynced={isVaultSynced}
                                onToggleVaultSync={handleVaultToggle}
                                personaMode={personaMode}
                                isVaultEnabled={isVaultConfigEnabled}
                                onTogglePersona={changePersona}
                                variant="standard"
                                onPollinations={generateWithPollinations} 
                                disableVisuals={isStoic}
                            />
                        </div>
                    </div>
                )}

            </div>

            <ModelPicker 
                isOpen={showModelPicker} 
                onClose={() => setShowModelPicker(false)}
                activeModelId={activeModel?.id || ''}
                onSelectModel={(id) => {
                    debugService.logAction(UI_REGISTRY.CHAT_BTN_MODEL_PICKER, FN_REGISTRY.CHAT_SELECT_MODEL, id);
                    setGlobalModelId(id);
                    if (activeThreadId) {
                        setThreads((prev: any[]) => prev.map((t: any) => t.id === activeThreadId ? { ...t, model_id: id } : t));
                    }
                    setShowModelPicker(false);
                }}
            />

            <ImageModelPicker 
                isOpen={showImagePicker}
                onClose={() => setShowImagePicker(false)}
                activeModelId={imageModelId || 'hydra'}
                onSelectModel={setImageModelId}
            />

            <ChatHistory 
                isOpen={showHistoryDrawer}
                onClose={() => setShowHistoryDrawer(false)}
                threads={threads}
                activeThreadId={activeThreadId}
                onSelectThread={setActiveThreadId}
                onDeleteThread={deleteThread}
                onRenameThread={renameThread}
                onTogglePin={togglePinThread}
                onNewChat={() => handleNewChat(personaMode)}
            />

            <NeuralLinkOverlay 
                isOpen={isLive && !isMinimized}
                status={liveStatus}
                personaMode={personaMode}
                transcriptHistory={transcriptHistory}
                interimTranscript={interimTranscript}
                onTerminate={stopSession}
                onMinimize={toggleMinimize}
                activeTool={activeTool}
                analyser={analyser}
            />
        </div>
    );
};

export default AIChatView;
