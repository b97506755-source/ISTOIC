
import React, { useState, useEffect } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { type Note } from '../../types';
import { type FeatureID } from '../../constants';
import { ArrowUpRight, ChevronRight, Target, Brain, Zap, FileText, ShieldCheck, DatabaseZap, Lock, Unlock, Activity, Clock, Cpu, Database, Fingerprint, Layers } from 'lucide-react';
import { VaultPinModal } from '../../components/VaultPinModal';
import { useVault } from '../../contexts/VaultContext';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { debugService } from '../../services/debugService';
import { DailyStoicWidget } from './components/DailyStoicWidget';

interface DashboardProps {
    onNavigate: (feature: FeatureID) => void;
    notes: Note[]; 
}

const StatBox: React.FC<{ label: string; value: string; isPulse?: boolean; color?: string; icon?: React.ReactNode; onClick?: () => void }> = ({ label, value, isPulse, color, icon, onClick }) => (
    <button 
        onClick={onClick}
        aria-label={`${label}: ${value}`}
        className={`relative overflow-hidden bg-skin-card/70 backdrop-blur-xl p-6 md:p-7 flex flex-col justify-between rounded-[32px] border border-skin-border hover:border-accent/30 shadow-sm hover:shadow-[0_20px_40px_-10px_var(--accent-glow)] transition-all duration-500 group h-full w-full text-left ring-1 ring-skin-border sheen ${onClick ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}`}
    >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-skin-surface rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-accent/10 transition-colors"></div>

        <div className="flex justify-between items-start relative z-10 w-full mb-6">
             <div className={`p-3 rounded-[18px] bg-skin-card border border-skin-border text-skin-muted group-hover:text-accent transition-colors shadow-sm`}>
                {icon ? React.cloneElement(icon as any, { size: 20, strokeWidth: 1.5 }) : <Activity size={20} />}
             </div>
             {isPulse && <div className={`w-2 h-2 rounded-full ${color?.replace('text-', 'bg-') || 'bg-accent'} animate-pulse shadow-[0_0_15px_currentColor]`} />}
        </div>
        
        <div className="relative z-10">
            <p className={`text-4xl lg:text-5xl font-black tracking-tighter italic leading-none group-hover:translate-x-1 transition-transform duration-500 ${color || 'text-skin-text'}`}>{value}</p>
            <div className="flex items-center gap-2 mt-3">
                <div className="h-[1px] w-4 bg-skin-border group-hover:w-8 group-hover:bg-accent/50 transition-all duration-500"></div>
                <p className="tech-mono text-[9px] text-skin-muted font-bold uppercase tracking-[0.2em]">{label}</p>
            </div>
        </div>
    </button>
);

const BentoCard: React.FC<{ 
    title: string; 
    desc: string; 
    icon: React.ReactNode; 
    onClick: () => void;
    className?: string;
    delay?: number;
    accentColor?: string;
    bgImage?: string;
}> = ({ title, desc, icon, onClick, className, delay, accentColor = "group-hover:text-accent" }) => {
    return (
        <button 
            onClick={onClick}
            aria-label={`Open ${title}`}
            style={{ animationDelay: `${delay}ms` }}
            className={`
                relative overflow-hidden cursor-pointer rounded-[40px] 
                bg-skin-card border border-skin-border sheen
                hover:border-accent/30 transition-all duration-500 animate-slide-up 
                shadow-sm hover:shadow-[0_30px_60px_-15px_var(--accent-glow)] 
                hover:-translate-y-1 active:scale-[0.99] group flex flex-col justify-between p-8 md:p-10 text-left
                ring-1 ring-skin-border
                ${className}
            `}
        >
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-skin-surface opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-4 group-hover:translate-x-0">
                <div className="p-2 rounded-full bg-skin-surface text-accent">
                    <ArrowUpRight size={20} />
                </div>
            </div>

            <div className="relative z-10 w-full h-full flex flex-col">
                <div className={`w-16 h-16 rounded-[24px] bg-skin-surface border border-skin-border flex items-center justify-center text-skin-muted ${accentColor} transition-all duration-500 mb-auto group-hover:scale-110 shadow-sm`}>
                    {React.cloneElement(icon as React.ReactElement<any>, { size: 32, strokeWidth: 1.5 })}
                </div>
                
                <div className="mt-8">
                    <h3 className="text-3xl md:text-4xl font-black text-skin-text uppercase italic tracking-tighter leading-[0.9] mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-skin-text group-hover:to-skin-muted transition-all">
                        {title}
                    </h3>
                    <p className="text-xs font-medium text-skin-muted leading-relaxed uppercase tracking-wide max-w-[90%] border-l border-skin-border pl-3 group-hover:border-accent/50 transition-colors">
                        {desc}
                    </p>
                </div>
            </div>
        </button>
    );
};

const DashboardView: React.FC<DashboardProps> = ({ onNavigate, notes }) => {
    const { isVaultUnlocked, unlockVault, lockVault, isVaultConfigEnabled } = useVault();
    const [personaMode] = useLocalStorage<'hanisah' | 'stoic'>('ai_persona_mode', 'hanisah');
    const [language] = useLocalStorage<string>('app_language', 'id');
    
    const [showPinModal, setShowPinModal] = useState(false);
    const [syncLevel, setSyncLevel] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const vaultEnabled = isVaultConfigEnabled(personaMode);

    useEffect(() => {
        const handleStatus = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatus);
        window.addEventListener('offline', handleStatus);

        let level = 20; 
        if (isOnline) level += 30; 
        if (isVaultUnlocked) level += 50; 
        setSyncLevel(level);

        return () => {
            window.removeEventListener('online', handleStatus);
            window.removeEventListener('offline', handleStatus);
        };
    }, [isVaultUnlocked, isOnline]);

    const handleNavSystem = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BTN_SYSTEM_STATUS, FN_REGISTRY.OPEN_SYSTEM_MECHANIC, 'NAV_SYSTEM');
        onNavigate('system');
    };

    const handleNavNotes = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_CARD_NOTES, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'NOTES_QUICK_ACCESS');
        onNavigate('notes');
    };

    const handleNavArchive = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BENTO_ARCHIVE, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'NOTES_ARCHIVE');
        onNavigate('notes');
    };

    const handleNavChat = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BENTO_CHAT, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'CHAT');
        onNavigate('chat');
    };

    const handleNavTools = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BENTO_TOOLS, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'TOOLS');
        onNavigate('tools');
    };

    const handleToggleVault = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BTN_VAULT_TOGGLE, FN_REGISTRY.TOGGLE_VAULT_LOCK, isVaultUnlocked ? 'LOCK' : 'UNLOCK_ATTEMPT');
        if (!vaultEnabled) return;
        if (isVaultUnlocked) {
            lockVault();
        } else {
            setShowPinModal(true);
        }
    };

    const handleRecentLogClick = () => {
        debugService.logAction(UI_REGISTRY.DASHBOARD_BTN_RECENT_LOGS, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'NOTES_FROM_RECENT');
        onNavigate('notes');
    };

    const t = {
        uptime: language === 'en' ? "SYSTEM ONLINE" : "SISTEM ONLINE",
        nodes: language === 'en' ? "TOTAL NOTES" : "TOTAL CATATAN",
        focus: language === 'en' ? "SYNC STATUS" : "STATUS SINKRON",
        archiveTitle: language === 'en' ? "ARCHIVE" : "ARSIP",
        archiveDesc: language === 'en' ? "Long-term storage." : "Penyimpanan data.",
        chatTitle: "AI ASSISTANT",
        chatDesc: language === 'en' ? "Virtual partner." : "Partner virtual.",
        toolsTitle: "AI TOOLS",
        toolsDesc: language === 'en' ? "Generative tools." : "Alat generatif.",
        recent: language === 'en' ? "RECENT ACTIVITY" : "AKTIVITAS TERBARU",
        control: language === 'en' ? "SECURITY" : "KEAMANAN",
    };

    return (
        <div className="h-full w-full overflow-y-auto custom-scroll flex flex-col px-4 pb-32 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:px-8 md:pt-12 md:pb-40 lg:px-12 animate-fade-in bg-noise relative z-10">
            <VaultPinModal 
                isOpen={showPinModal} 
                onClose={() => setShowPinModal(false)} 
                onSuccess={() => unlockVault()} 
            />

            <div className="max-w-[1400px] mx-auto w-full space-y-10 md:space-y-12">
                
                <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10 animate-slide-up pb-2">
                    <div className="space-y-6 md:space-y-8 flex-1 w-full">
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-2 rounded-xl bg-skin-card border border-skin-border backdrop-blur-md tech-mono text-[9px] font-black uppercase text-accent tracking-[0.3em] shadow-[0_0_20px_rgba(var(--accent-rgb),0.2)] flex items-center gap-2">
                                <Fingerprint size={12} /> PERSONAL_OS_v101.0
                            </div>
                            <div className="h-[1px] w-12 bg-gradient-to-r from-accent/50 to-transparent"></div>
                            <button 
                                onClick={handleNavSystem}
                                className="text-skin-muted tech-mono text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:text-accent transition-colors"
                                title="Open System Mechanic"
                                aria-label="System Uptime Status"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></span>
                                {t.uptime}
                            </button>
                        </div>
                        <h1 className="text-[13vw] md:text-[7rem] xl:text-[8rem] font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-skin-text via-skin-text to-skin-muted leading-[0.85] uppercase drop-shadow-2xl break-words">
                             DASHBOARD <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-500 animate-gradient-text">UTAMA</span>
                        </h1>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-5 w-full xl:w-auto min-w-[280px] md:min-w-[360px] lg:h-40">
                        <StatBox 
                            label={t.nodes} 
                            value={notes.length.toString().padStart(2, '0')} 
                            icon={<FileText />}
                            onClick={handleNavNotes}
                        />
                        <StatBox 
                            label={t.focus} 
                            value={`${syncLevel}%`} 
                            isPulse={true} 
                            color={syncLevel > 90 ? 'text-accent' : 'text-yellow-500'}
                            icon={<Activity />}
                            onClick={handleNavSystem} 
                        />
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6 md:gap-8">
                    
                    <div className="md:col-span-6 lg:col-span-8">
                        <DailyStoicWidget />
                    </div>

                    <BentoCard 
                        title={t.chatTitle} 
                        desc={t.chatDesc} 
                        icon={<Brain />} 
                        onClick={handleNavChat} 
                        className="md:col-span-3 lg:col-span-4 min-h-[280px] lg:h-full"
                        delay={100}
                        accentColor={personaMode === 'hanisah' ? "group-hover:text-orange-500" : "group-hover:text-cyan-500"}
                    />
                    
                    <BentoCard 
                        title={t.archiveTitle} 
                        desc={t.archiveDesc} 
                        icon={<Database />} 
                        onClick={handleNavArchive} 
                        className="md:col-span-3 lg:col-span-4 min-h-[280px] lg:aspect-square"
                        delay={200}
                    />
                    
                    <BentoCard 
                        title={t.toolsTitle} 
                        desc={t.toolsDesc} 
                        icon={<Zap />} 
                        onClick={handleNavTools} 
                        className="md:col-span-6 lg:col-span-8 min-h-[280px]"
                        delay={300}
                    />

                    <div className="md:col-span-6 lg:col-span-8 bg-skin-card rounded-[40px] border border-skin-border p-8 md:p-10 flex flex-col justify-between animate-slide-up shadow-sm ring-1 ring-skin-border" style={{ animationDelay: '400ms' }}>
                        <div className="flex items-center justify-between mb-8 border-b border-skin-border pb-6">
                            <h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-skin-text flex items-center gap-4">
                                <Clock size={28} className="text-accent" /> {t.recent}
                            </h3>
                            <button onClick={handleNavNotes} aria-label="Go to Archive" className="w-12 h-12 rounded-xl bg-skin-surface hover:bg-accent hover:text-black flex items-center justify-center transition-all">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {notes.slice(0, 3).map((note, i) => (
                                <div key={note.id} onClick={handleRecentLogClick} role="button" tabIndex={0} className="group flex items-center gap-6 p-4 rounded-[24px] bg-skin-surface border border-transparent hover:border-accent/20 hover:bg-skin-card transition-all cursor-pointer">
                                    <div className="w-12 h-12 rounded-xl bg-skin-surface-hover flex items-center justify-center text-skin-muted group-hover:text-accent group-hover:scale-110 transition-transform shrink-0">
                                        <FileText size={20} strokeWidth={2} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-skin-text uppercase tracking-tight truncate">{note.title || "UNTITLED_ENTRY"}</h4>
                                        <p className="text-[10px] tech-mono text-skin-muted truncate mt-0.5">ID: {note.id.slice(0,8)} // {new Date(note.updated).toLocaleDateString()}</p>
                                    </div>
                                    <div className="px-3 py-1 rounded-lg bg-skin-surface-hover text-[9px] font-black text-skin-muted uppercase tracking-widest group-hover:bg-accent/10 group-hover:text-accent transition-colors">OPEN</div>
                                </div>
                            ))}
                            {notes.length === 0 && (
                                <div className="text-center py-12 opacity-40 text-[10px] font-black uppercase tracking-widest text-skin-muted">NO_DATA_LOGGED</div>
                            )}
                        </div>
                    </div>

                    <div className={`md:col-span-6 lg:col-span-4 p-8 md:p-10 rounded-[40px] border transition-all duration-500 flex flex-col justify-between group shadow-lg animate-slide-up h-full ${isVaultUnlocked ? 'bg-gradient-to-br from-skin-card to-skin-surface border-accent/30 shadow-[0_0_40px_-10px_var(--accent-glow)]' : 'bg-skin-surface border-transparent opacity-80'}`} style={{ animationDelay: '500ms' }}>
                        <div>
                            <div className="flex justify-between items-start mb-8">
                                <div className={`p-4 rounded-[20px] ${isVaultUnlocked ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'bg-skin-surface-hover text-skin-muted'}`}>
                                    <DatabaseZap size={32} strokeWidth={1.5} />
                                </div>
                                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isVaultUnlocked ? 'border-accent text-accent bg-accent/5' : 'border-skin-border text-skin-muted'}`}>
                                    {isVaultUnlocked ? 'UNLOCKED' : 'SECURE'}
                                </div>
                            </div>
                            <h3 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter leading-none text-skin-text">{t.control}</h3>
                            <p className="text-xs font-medium text-skin-muted mt-4 leading-relaxed">
                                {isVaultUnlocked ? "Akses data terbuka. Vault tidak terkunci." : "Autentikasi diperlukan untuk akses data terenkripsi."}
                            </p>
                        </div>
                        
                        <button 
                            onClick={vaultEnabled ? handleToggleVault : handleNavTools}
                            aria-label={!vaultEnabled ? 'Vault Disabled' : isVaultUnlocked ? 'Lock Vault' : 'Unlock Vault'}
                            className={`w-full py-5 rounded-[20px] font-black uppercase text-[11px] tracking-[0.25em] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-md mt-8 ${
                                !vaultEnabled ? 'bg-black/10 text-neutral-500 cursor-not-allowed' :
                                isVaultUnlocked ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20' : 
                                'bg-skin-text text-skin-card hover:bg-accent hover:text-black hover:shadow-[0_0_30px_var(--accent-glow)]'
                            }`}
                        >
                            {isVaultUnlocked ? <Lock size={16}/> : <Unlock size={16}/>}
                            {!vaultEnabled ? 'DISABLED' : isVaultUnlocked ? 'KUNCI SEKARANG' : 'BUKA KUNCI'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DashboardView;
