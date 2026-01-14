
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
import { Button } from '../../components/ui/Button';
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
                'group relative flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-300 font-semibold',
                mode === 'hanisah'
                    ? 'bg-gradient-to-r from-[var(--accent)]/15 to-[var(--accent)]/5 border-[color:var(--accent)]/40 text-[var(--accent)]'
                    : 'bg-gradient-to-r from-[var(--accent-2)]/15 to-[var(--accent-2)]/5 border-[color:var(--accent-2)]/40 text-[var(--accent-2)]'
            )}
        >
            <div className={cn('w-2 h-2 rounded-full transition-all duration-300', mode === 'hanisah' ? 'bg-[var(--accent)]' : 'bg-[var(--accent-2)]')} />
            <span className="caption font-bold leading-none text-[13px]">{mode === 'hanisah' ? 'Hanisah' : 'Stoic'}</span>
            <div className="w-[1px] h-4 bg-current opacity-30 mx-0.5"></div>
            {mode === 'hanisah' ? <Flame size={14} strokeWidth={2.5} /> : <Brain size={14} strokeWidth={2.5} />}
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
        className="relative overflow-hidden group text-left transition-all duration-300 ease-out hover:-translate-y-1 active:scale-[0.97] flex items-center gap-5 h-full animate-slide-up border border-[color:var(--border)]/40 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] hover:border-[color:var(--border)]/80 hover:bg-gradient-to-br hover:from-[var(--surface)]/98 hover:to-[var(--surface-2)]/95 shadow-sm hover:shadow-lg"
    >
        <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface)] flex items-center justify-center transition-all duration-300 group-hover:scale-125 border border-[color:var(--border)]/60 group-hover:border-[color:var(--border)]', accent)}>
            {React.cloneElement(icon as React.ReactElement<any>, { size: 20, strokeWidth: 2.2 })}
        </div>
        <div className="flex-1 min-w-0">
            <h4 className="section-title text-text font-bold text-[15px]">{label}</h4>
            <p className="caption text-text-muted text-[13px] truncate opacity-85 group-hover:opacity-100 transition-opacity">{desc}</p>
        </div>
        <div className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors duration-300">
            <Code size={18} strokeWidth={2} />
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
        <div className="h-full w-full relative bg-noise flex flex-col overflow-hidden px-3 md:px-4" style={{ overscrollBehavior: 'contain' }}>
            <VaultPinModal isOpen={showPinModal} onClose={() => setShowPinModal(false)} onSuccess={() => setIsVaultSynced(true)} />
            
            <header className="shrink-0 z-50 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
                <Card tone="translucent" padding="sm" className="border-border/60 shadow-[0_24px_90px_-60px_rgba(var(--accent-rgb),0.9)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-11 px-4 rounded-[var(--radius-md)]"
                                onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_BTN_MODEL_PICKER, FN_REGISTRY.CHAT_SELECT_MODEL, 'OPEN'); setShowModelPicker(true); }}
                            >
                                <span className="flex items-center gap-2">
                                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${isHydraActive ? 'bg-[color:var(--success)]/15 text-[color:var(--success)]' : 'bg-[color:var(--surface-2)] text-[color:var(--text)]'}`}>
                                        {isHydraActive ? <Infinity size={16} className="animate-pulse" strokeWidth={2.5} /> : <Zap size={16} strokeWidth={2.5} />}
                                    </span>
                                    <span className="caption font-semibold text-text">{isHydraActive ? 'Hydra' : (activeModel?.name?.split(' ')[0] || 'Model')}</span>
                                </span>
                            </Button>
                            <PersonaToggle mode={personaMode} onToggle={changePersona} />
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-[color:var(--surface-2)] text-xs font-semibold text-text-muted">{isVaultSynced ? 'Vault sinkron' : 'Vault off'}</span>
                                <span className="px-3 py-1 rounded-full bg-[color:var(--surface-2)] text-xs font-semibold text-text-muted">{threads.length} sesi</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 p-0 rounded-[var(--radius-md)]"
                                disabled={isStoic}
                                onClick={() => !isStoic && setShowImagePicker(true)}
                            >
                                {isStoic ? <Lock size={18} strokeWidth={2.5} /> : <ImageIcon size={18} strokeWidth={2.5} />}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 p-0 rounded-[var(--radius-md)]"
                                onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_BTN_HISTORY, FN_REGISTRY.CHAT_LOAD_HISTORY, 'OPEN'); setShowHistoryDrawer(true); }}
                            >
                                <History size={18} strokeWidth={2.5} />
                            </Button>
                            <Button
                                variant={isLive ? 'destructive' : 'ghost'}
                                size="sm"
                                className="h-10 w-10 p-0 rounded-[var(--radius-md)]"
                                disabled={!isLiveLinkEnabled}
                                onClick={() => { if (isLiveLinkEnabled) { isLive ? stopSession() : startSession(personaMode); } }}
                            >
                                <Radio size={18} strokeWidth={2.5} />
                            </Button>
                        </div>
                    </div>
                </Card>
            </header>
            <div className="flex-1 min-h-0 relative w-full max-w-[900px] mx-auto pt-4">
                {showEmptyState ? (
                    <div className="flex flex-col h-full justify-center items-center w-full pb-20 animate-fade-in overflow-y-auto custom-scroll px-4">
                            <div className="text-center mb-12 space-y-5">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 text-[var(--accent)] border border-[color:var(--accent)]/30 shadow-lg">
                                {personaMode === 'hanisah' ? <Flame size={40} strokeWidth={1.5} /> : <Brain size={40} strokeWidth={1.5} />}
                            </div>
                            <div>
                                <h2 className="page-title text-2xl md:text-3xl font-bold text-[var(--text)]">{personaMode === 'hanisah' ? 'Hanisah' : 'Stoic'}</h2>
                                <p className="body-sm text-[var(--text-muted)] mt-2 text-[15px] font-medium">{personaMode === 'hanisah' ? 'Percakapan natural, empatik & kreatif' : 'Analisis runtut, logis & objektif'}</p>
                            </div>
                            </div>
                        <div className="w-full max-w-2xl mx-auto animate-slide-up relative z-20" style={{ animationDelay: '100ms' }}>
                            <ChatInput input={input} setInput={setInput} isLoading={isLoading} onSubmit={sendMessage} onStop={stopGeneration} onNewChat={() => handleNewChat(personaMode)} onFocusChange={() => {}} aiName={personaMode.toUpperCase()} isVaultSynced={isVaultSynced} onToggleVaultSync={handleVaultToggle} personaMode={personaMode} isVaultEnabled={isVaultConfigEnabled} onTogglePersona={changePersona} variant="hero" onPollinations={generateWithPollinations} disableVisuals={isStoic} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mx-auto mt-10">
                            {!isStoic ? <SuggestionCard icon={<SparklesIcon />} label="Buat Visual" desc="Buatkan gambar beresolusi tinggi." onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'GEN_IMG'); setInput("Buatkan gambar pemandangan cinematic dengan pencahayaan hangat."); }} accent="text-[var(--accent)] group-hover:text-[var(--accent)]" delay={150} /> : <SuggestionCard icon={<Brain />} label="First Principles" desc="Urai masalah kompleks dari dasar." onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'LOGIC'); setInput("Analisis masalah ini dengan first principles: [Masalah]"); }} accent="text-[var(--accent-2)] group-hover:text-[var(--accent-2)]" delay={150} />}
                            <SuggestionCard icon={<Code />} label="Code Audit" desc="Debug & optimalkan algoritma." onClick={() => { debugService.logAction(UI_REGISTRY.CHAT_SUGGESTION_CARD, FN_REGISTRY.CHAT_SEND_MESSAGE, 'CODE_AUDIT'); setInput("Analisis algoritma ini untuk kompleksitas: [Kode]"); }} accent="text-[var(--success)] group-hover:text-[var(--success)]" delay={200} />
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
            {!showEmptyState && (
                <div className={`shrink-0 z-50 w-full flex justify-center pb-[calc(env(safe-area-inset-bottom)+1rem)] px-3 md:px-4 transition-all duration-300 ${isMobileNavVisible ? 'mb-16' : ''}`}>
                    <div className="w-full max-w-[900px] pointer-events-auto relative">
                        {showScrollBtn && (
                            <button onClick={() => scrollToBottom()} className="absolute -top-20 right-0 md:right-4 z-20 w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] shadow-xl border border-[color:var(--accent)]/40 flex items-center justify-center text-white animate-bounce active:scale-90 transition-all duration-200">
                                <ArrowDown size={22} strokeWidth={2.5} />
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
