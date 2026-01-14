
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Radio, Flame, Brain, Code, History, Infinity, ArrowDown,
  Sparkles as SparklesIcon, Zap, Image as ImageIcon, Lock, Loader2
} from 'lucide-react';
import { ChatHistory } from './components/ChatHistory';
import { ModelPicker } from './components/ModelPicker';
import { ImageModelPicker } from './components/ImageModelPicker';
import { NeuralLinkOverlay } from './components/NeuralLinkOverlay';
import { ChatInput } from './components/ChatInput'; 
import { ChatWindow } from './components/ChatWindow'; 
import { VaultPinModal } from '../../components/VaultPinModal';
import { Card } from '../../components/ui/Card';
import { cn } from '../../utils/cn';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { useNavigationIntelligence } from '../../hooks/useNavigationIntelligence';
import { useFeatures } from '../../contexts/FeatureContext';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { debugService } from '../../services/debugService';

interface AIChatViewProps {
    chatLogic: any;
}

const PersonaToggle: React.FC<{ mode: 'hanisah' | 'stoic'; onToggle: () => void; }> = React.memo(({ mode, onToggle }) => {
    return (
        <button 
            onClick={onToggle}
            className={cn(
                'group relative flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] border transition-all duration-300',
                mode === 'hanisah'
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'bg-surface-2 border-border text-text'
            )}
        >
            <div className={cn('w-1.5 h-1.5 rounded-full', mode === 'hanisah' ? 'bg-accent' : 'bg-text-muted')} />
            <span className="caption">{mode === 'hanisah' ? 'Hanisah' : 'Stoic'}</span>
            <div className="w-[1px] h-3 bg-current opacity-20 mx-1"></div>
            {mode === 'hanisah' ? <Flame size={12} strokeWidth={2.2} /> : <Brain size={12} strokeWidth={2.2} />}
        </button>
    );
});

const SuggestionCard: React.FC<{ icon: React.ReactNode, label: string, desc: string, onClick: () => void, accent?: string, delay?: number }> = React.memo(({ icon, label, desc, onClick, accent = "text-text-muted group-hover:text-accent", delay = 0 }) => (
    <Card
        as="button"
        interactive
        padding="md"
        onClick={onClick}
        style={{ animationDelay: `${delay}ms` }}
        className="relative overflow-hidden group text-left transition-all duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.98] flex items-center gap-4 h-full animate-slide-up"
    >
        <div className={cn('w-10 h-10 rounded-[var(--radius-md)] bg-surface-2 flex items-center justify-center transition-all duration-300 group-hover:scale-110 border border-border', accent)}>
            {React.cloneElement(icon as React.ReactElement<any>, { size: 18, strokeWidth: 2 })}
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="section-title text-text truncate">{label}</h4>
            <p className="caption text-text-muted truncate opacity-80 group-hover:opacity-100 transition-opacity">{desc}</p>
        </div>
    </Card>
));

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

    const { threads, setThreads, activeThread, activeThreadId, setActiveThreadId, input, setInput, isLoading, activeModel, personaMode, handleNewChat, sendMessage, retryMessage, stopGeneration, togglePinThread, deleteThread, renameThread, isVaultSynced, setIsVaultSynced, isVaultConfigEnabled, setIsLiveModeActive, setGlobalModelId, generateWithPollinations, imageModelId, setImageModelId, isThreadsLoaded } = chatLogic;

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isAutoScrolling = useRef(true);
    const isStoic = personaMode === 'stoic';
    const bgGradient = 'bg-gradient-to-b from-[color:var(--accent)]/6 to-transparent';

    const { isLive, isMinimized, status: liveStatus, transcript: transcriptHistory, interimTranscript, startSession, stopSession, toggleMinimize, analyser, activeTool } = useLiveSession();

    useEffect(() => { if (setIsLiveModeActive) setIsLiveModeActive(isLive); }, [isLive, setIsLiveModeActive]);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
            setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' }); }, 50);
            isAutoScrolling.current = true;
            setShowScrollBtn(false);
        }
    }, []);

    if (!isThreadsLoaded) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-bg text-text animate-fade-in">
                <Loader2 size={32} className="animate-spin text-accent" />
                <span className="caption text-text-muted">Loading conversations...</span>
            </div>
        );
    }

    const handleVaultToggle = useCallback(() => {
        if (!isVaultConfigEnabled || isTransitioning) return;
        if (isVaultSynced) setIsVaultSynced(false); else setShowPinModal(true);
    }, [isVaultSynced, isTransitioning, setIsVaultSynced, isVaultConfigEnabled]);

    const changePersona = async () => {
        const target = personaMode === 'hanisah' ? 'stoic' : 'hanisah';
        setIsTransitioning(true);
        await handleNewChat(target);
        setTimeout(() => setIsTransitioning(false), 300);
    };

    const showEmptyState = !isLoading && (!activeThreadId || !activeThread || (activeThread.messages?.length || 0) <= 1);
    const isHydraActive = activeModel?.id === 'auto-best';

    return (
        <div className={`h-full w-full relative bg-noise flex flex-col ${bgGradient} overflow-hidden`} style={{ overscrollBehavior: 'contain' }}>
            <VaultPinModal isOpen={showPinModal} onClose={() => setShowPinModal(false)} onSuccess={() => setIsVaultSynced(true)} />
            
            {/* --- 1. HEADER (FIXED TOP) --- */}
            <header className="shrink-0 z-50 flex justify-center pt-[env(safe-area-inset-top)] px-4 w-full">
                <div className={`mt-2 backdrop-blur-2xl border rounded-[20px] p-1.5 flex items-center justify-between gap-1 shadow-sm transition-all duration-500 bg-[var(--surface)]/95 border-[color:var(--border)] ring-1 ring-[color:var(--border)]`}>
                    <button className="flex items-center gap-2 group py-1.5 px-3 rounded-xl transition-all cursor-pointer hover:bg-[var(--surface-2)] active:scale-95" onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_BTN_MODEL_PICKER, FN_REGISTRY.CHAT_SELECT_MODEL, 'OPEN'); setShowModelPicker(true); }}>
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${isHydraActive ? 'text-[var(--success)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text)]'}`}>
                            {isHydraActive ? <Infinity size={14} className="animate-pulse" /> : <Zap size={14} />}
                        </div>
                        <span className={`caption font-semibold leading-none ${isHydraActive ? 'text-success' : 'text-text-muted group-hover:text-text'}`}>{isHydraActive ? 'Hydra' : (activeModel?.name?.split(' ')[0] || 'Model')}</span>
                    </button>
                    <div className="h-4 w-[1px] bg-[color:var(--border)] mx-1"></div>
                    <PersonaToggle mode={personaMode} onToggle={changePersona} />
                    <div className="h-4 w-[1px] bg-[color:var(--border)] mx-1"></div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => !isStoic && setShowImagePicker(true)} disabled={isStoic} className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center active:scale-90 group ${isStoic ? 'opacity-50 cursor-not-allowed bg-[var(--surface-2)]' : 'text-[var(--accent)] hover:bg-[var(--accent)]/10'}`}>
                            {isStoic ? <Lock size={14} /> : <ImageIcon size={16} strokeWidth={2} />}
                        </button>
                        <button onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_BTN_HISTORY, FN_REGISTRY.CHAT_LOAD_HISTORY, 'OPEN'); setShowHistoryDrawer(true); }} className="w-8 h-8 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-all flex items-center justify-center active:scale-90 group">
                            <History size={16} strokeWidth={2} />
                        </button>
                        <button onClick={() => { if (isLiveLinkEnabled) { isLive ? stopSession() : startSession(personaMode); } }} className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center active:scale-95 ${!isLiveLinkEnabled ? 'opacity-30 cursor-not-allowed' : isLive ? 'bg-[var(--danger)] text-[var(--on-accent-color)] animate-pulse' : 'text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10'}`} disabled={!isLiveLinkEnabled}>
                            <Radio size={16} strokeWidth={2} />
                        </button>
                    </div>
                </div>
            </header>

            {/* --- 2. CHAT CONTENT (FLEXIBLE) --- */}
            {/* Main content expands to fill available space, Virtuoso handles internal scroll */}
            <div className="flex-1 min-h-0 relative w-full max-w-[900px] mx-auto pt-2">
                {showEmptyState ? (
                    <div className="flex flex-col h-full justify-center items-center w-full pb-20 animate-fade-in overflow-y-auto custom-scroll px-4">
                            <div className="text-center mb-10 space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] mb-2 bg-[var(--surface-2)] text-[var(--accent)]">
                                {personaMode === 'hanisah' ? <Flame size={32} /> : <Brain size={32} />}
                            </div>
                            <div>
                                <h2 className="page-title text-[var(--text)]">{personaMode === 'hanisah' ? 'Hanisah' : 'Stoic'}</h2>
                                <p className="body-sm text-[var(--text-muted)]">{personaMode === 'hanisah' ? 'Percakapan natural dan empatik' : 'Analisis runtut dan fokus'}</p>
                            </div>
                            </div>
                        
                        {/* INPUT IN EMPTY STATE */}
                         <div className="w-full max-w-2xl mx-auto animate-slide-up relative z-20" style={{ animationDelay: '100ms' }}>
                            <ChatInput input={input} setInput={setInput} isLoading={isLoading} onSubmit={sendMessage} onStop={stopGeneration} onNewChat={() => handleNewChat(personaMode)} onFocusChange={() => {}} aiName={personaMode.toUpperCase()} isVaultSynced={isVaultSynced} onToggleVaultSync={handleVaultToggle} personaMode={personaMode} isVaultEnabled={isVaultConfigEnabled} onTogglePersona={changePersona} variant="hero" onPollinations={generateWithPollinations} disableVisuals={isStoic} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mx-auto mt-8 opacity-80">
                            {!isStoic ? <SuggestionCard icon={<SparklesIcon />} label="Generate visual" desc="Create high-fidelity images." onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'GEN_IMG'); setInput("Generate a cinematic landscape with warm lighting."); }} accent="text-[var(--accent)] group-hover:text-[var(--accent)]" delay={150} /> : <SuggestionCard icon={<Brain />} label="First principles" desc="Deconstruct complex problems." onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'LOGIC'); setInput("Analyze this problem using first principles: [Insert Problem]"); }} accent="text-[var(--accent-2)] group-hover:text-[var(--accent-2)]" delay={150} />}
                            <SuggestionCard icon={<Code />} label="Code audit" desc="Debug & optimize algorithms." onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'CODE_AUDIT'); setInput("Analyze this algorithm for complexity: [Paste Code]"); }} accent="text-[var(--success)] group-hover:text-[var(--success)]" delay={200} />
                        </div>
                    </div>
                ) : (
                    <ChatWindow 
                        key={activeThreadId || 'new'} 
                        messages={activeThread?.messages || []} 
                        personaMode={personaMode} 
                        isLoading={isLoading} 
                        messagesEndRef={messagesEndRef} 
                        onRetry={retryMessage}
                    />
                )}
            </div>

            {/* --- 3. INPUT (FIXED BOTTOM) --- */}
            {!showEmptyState && (
                <div className={`shrink-0 z-50 w-full flex justify-center pb-[calc(env(safe-area-inset-bottom)+1rem)] px-4 md:px-0 transition-all duration-300 ${isMobileNavVisible ? 'mb-16' : ''}`}>
                    <div className="w-full max-w-[900px] pointer-events-auto relative">
                        {showScrollBtn && (
                            <button onClick={() => scrollToBottom()} className="absolute -top-16 right-0 z-20 w-10 h-10 rounded-full bg-white dark:bg-[#0a0a0b] shadow-xl border border-black/10 dark:border-white/10 flex items-center justify-center text-accent animate-bounce">
                                <ArrowDown size={18} strokeWidth={2.5} />
                            </button>
                        )}
                        <ChatInput input={input} setInput={setInput} isLoading={isLoading} onSubmit={sendMessage} onStop={stopGeneration} onNewChat={() => handleNewChat(personaMode)} onFocusChange={() => {}} aiName={personaMode.toUpperCase()} isVaultSynced={isVaultSynced} onToggleVaultSync={handleVaultToggle} personaMode={personaMode} isVaultEnabled={isVaultConfigEnabled} onTogglePersona={changePersona} variant="standard" onPollinations={generateWithPollinations} disableVisuals={isStoic} />
                    </div>
                </div>
            )}

            <ModelPicker isOpen={showModelPicker} onClose={() => setShowModelPicker(false)} activeModelId={activeModel?.id || ''} onSelectModel={(id) => { setGlobalModelId(id); if (activeThreadId) setThreads((prev: any[]) => prev.map((t: any) => t.id === activeThreadId ? { ...t, model_id: id } : t)); setShowModelPicker(false); }} />
            <ImageModelPicker isOpen={showImagePicker} onClose={() => setShowImagePicker(false)} activeModelId={imageModelId || 'hydra'} onSelectModel={setImageModelId} />
            <ChatHistory isOpen={showHistoryDrawer} onClose={() => setShowHistoryDrawer(false)} threads={threads} activeThreadId={activeThreadId} onSelectThread={setActiveThreadId} onDeleteThread={deleteThread} onRenameThread={renameThread} onTogglePin={togglePinThread} onNewChat={() => handleNewChat(personaMode)} />
            <NeuralLinkOverlay isOpen={isLive && !isMinimized} status={liveStatus} personaMode={personaMode} transcriptHistory={transcriptHistory} interimTranscript={interimTranscript} onTerminate={stopSession} onMinimize={toggleMinimize} activeTool={activeTool} analyser={analyser} />
        </div>
    );
};

export default React.memo(AIChatView);
