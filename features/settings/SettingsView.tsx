import React, { useState, useRef, useEffect } from 'react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { 
    Shield, Trash2, Cpu, Languages, Palette, Layout, Save, CheckCircle2, 
    Volume2, Mic2, Moon, Sun, Monitor, X, Check, HelpCircle, RefreshCw,
    Terminal, UserCheck, Sparkles, MessageSquare, ChevronRight, Activity, Zap, Globe, User, UserRound, Play, Info,
    Flame, Brain, DatabaseZap, Image as ImageIcon, HardDrive, Download, Upload, FileJson, Edit3, Undo2, Loader2,
    Network, Key, Eye, EyeOff, ToggleLeft, ToggleRight, Power, Lock, Unlock, Server, AlertTriangle, QrCode, ScanFace
} from 'lucide-react';
// ... (Rest of imports)
import { THEME_COLORS } from '../../App';
import { speakWithHanisah } from '../../services/elevenLabsService';
import { useVault } from '../../contexts/VaultContext';
import { TRANSLATIONS, type LanguageCode } from '../../services/i18n';
import { DEFAULT_USER_PERSONA } from '../../services/persona';
import { debugService } from '../../services/debugService';
import { KEY_MANAGER, type ProviderStatus } from '../../services/geminiService';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { type FeatureID } from '../../constants';
import { setSystemPin, isSystemPinConfigured } from '../../utils/crypto';
import { HANISAH_KERNEL } from '../../services/melsaKernel';
import { SharedQRCode } from '../../components/SharedQRCode';
import { BiometricService } from '../../services/biometricService';

interface SettingsViewProps {
    onNavigate?: (feature: FeatureID) => void;
}

interface ToolConfig {
    search: boolean;
    vault: boolean;
    visual: boolean;
}

// ... (SUB-COMPONENTS: PromptEditorModal, SettingsSection, SettingsItem, ToolRow, ProviderToggleRow - kept same)

const PromptEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    persona: 'hanisah' | 'stoic';
    currentPrompt: string;
    onSave: (val: string) => void;
    onReset: () => void;
}> = ({ isOpen, onClose, persona, currentPrompt, onSave, onReset }) => {
    const [value, setValue] = useState(currentPrompt);
    
    useEffect(() => { setValue(currentPrompt); }, [currentPrompt, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
            <div className="w-full max-w-3xl bg-skin-card border border-skin-border rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[80vh] md:h-[600px] animate-slide-up ring-1 ring-skin-border">
                <div className="p-6 border-b border-skin-border flex justify-between items-center bg-skin-surface">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${persona === 'hanisah' ? 'bg-orange-500/10 text-orange-500' : 'bg-cyan-500/10 text-cyan-500'} border border-skin-border`}>
                            {persona === 'hanisah' ? <Flame size={24} /> : <Brain size={24} />}
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-skin-text">PROMPT EDITOR</h3>
                            <p className="text-[10px] text-skin-muted font-mono uppercase tracking-widest mt-1">Modifying {persona.toUpperCase()} Behavior</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-skin-surface-hover rounded-full text-skin-muted hover:text-skin-text transition-all">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-1 p-0 relative group bg-black">
                    <textarea 
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full h-full bg-transparent p-8 text-sm font-mono text-neutral-300 focus:outline-none resize-none leading-relaxed custom-scroll selection:bg-accent/20"
                        placeholder="Enter system prompt instructions..."
                    />
                    <div className="absolute bottom-4 right-4 text-[9px] font-mono text-neutral-600 pointer-events-none bg-black/50 px-2 py-1 rounded">
                        CHARS: {value.length}
                    </div>
                </div>

                <div className="p-6 border-t border-skin-border bg-skin-surface flex justify-between items-center gap-4">
                    <button 
                        onClick={() => { if(confirm('Reset to factory default?')) { onReset(); onClose(); } }}
                        className="px-6 py-3 rounded-xl border border-skin-border hover:bg-red-500/10 text-skin-muted hover:text-red-500 hover:border-red-500/30 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 group"
                    >
                        <Undo2 size={14} className="group-hover:-rotate-180 transition-transform duration-500" /> RESET_DEFAULT
                    </button>
                    <button 
                        onClick={() => { onSave(value); onClose(); }}
                        className="px-8 py-3 rounded-xl bg-skin-text text-skin-card hover:bg-accent hover:text-black text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_var(--accent-glow)] flex items-center gap-2 transform hover:scale-105 active:scale-95"
                    >
                        <Save size={14} /> SAVE_PROMPT
                    </button>
                </div>
            </div>
        </div>
    );
};

const SettingsSection: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode; className?: string }> = ({ title, children, icon, className }) => (
    <div className={`space-y-6 animate-slide-up ${className}`}>
        <div className="flex items-center gap-3 px-2">
            <div className="p-2.5 bg-accent/10 rounded-xl text-accent border border-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)]">{icon}</div>
            <h3 className="text-[11px] font-black text-skin-text tech-mono uppercase tracking-[0.3em]">{title}</h3>
        </div>
        <div className="bg-skin-card border border-skin-border rounded-[32px] overflow-hidden p-2 md:p-3 shadow-sm relative backdrop-blur-md">
            {children}
        </div>
    </div>
);

const SettingsItem: React.FC<{ label: string; desc: string; icon: React.ReactNode; action: React.ReactNode }> = ({ label, desc, icon, action }) => (
    <div className="p-5 md:p-6 bg-skin-card rounded-[24px] mb-2 last:mb-0 border border-skin-border flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-accent/30 transition-all group shadow-sm hover:shadow-md">
        <div className="flex items-start gap-5">
            <div className="w-12 h-12 rounded-[18px] bg-skin-surface flex items-center justify-center text-skin-muted group-hover:text-accent group-hover:scale-110 transition-all shrink-0 border border-skin-border group-hover:bg-accent/5 group-hover:shadow-[0_0_20px_-5px_var(--accent-glow)]">
                {icon}
            </div>
            <div className="space-y-1.5">
                <h4 className="text-sm font-black text-skin-text uppercase tracking-tight leading-none group-hover:text-accent transition-colors">{label}</h4>
                <p className="text-[9px] text-skin-muted font-bold uppercase tracking-widest leading-relaxed max-w-sm">{desc}</p>
            </div>
        </div>
        <div className="w-full md:w-auto self-end md:self-center">
            {action}
        </div>
    </div>
);

const ToolRow: React.FC<{ 
    label: string; 
    description: string;
    icon: React.ReactNode; 
    isActive: boolean; 
    onClick: () => void;
    activeColor: string; 
    badge?: string;
}> = ({ label, description, icon, isActive, onClick, activeColor, badge }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center justify-between p-3.5 rounded-[20px] border transition-all duration-300 group text-left ${
            isActive 
            ? 'bg-skin-card border-skin-border shadow-md' 
            : 'bg-transparent border-transparent hover:bg-skin-surface opacity-60 hover:opacity-100'
        }`}
    >
        <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                isActive ? `${activeColor} text-white shadow-lg` : 'bg-skin-surface text-skin-muted'
            }`}>
                {React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}
            </div>
            <div className="">
                <div className="flex items-center gap-2">
                    <h5 className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-skin-text' : 'text-skin-muted'}`}>{label}</h5>
                    {badge && isActive && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[7px] font-bold tracking-wider">{badge}</span>
                    )}
                </div>
                <p className="text-[9px] text-skin-muted font-medium leading-tight max-w-[150px] sm:max-w-[200px] mt-0.5 truncate">{description}</p>
            </div>
        </div>
        
        <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 relative ${
            isActive ? activeColor : 'bg-zinc-300 dark:bg-zinc-700'
        }`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-all duration-300 ${
                isActive ? 'left-[20px]' : 'left-1'
            }`} />
        </div>
    </button>
);

const ProviderToggleRow: React.FC<{ 
    provider: string; 
    isEnabled: boolean;
    hasKey: boolean;
    onToggle: () => void;
}> = ({ provider, isEnabled, hasKey, onToggle }) => {
    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between p-4 rounded-[20px] border transition-all ${isEnabled ? 'bg-skin-card border-skin-border shadow-sm' : 'bg-skin-surface/50 border-transparent opacity-60'}`}>
            <div className="flex items-center gap-4 w-full sm:w-auto mb-3 sm:mb-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isEnabled ? (hasKey ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500') : 'bg-skin-surface text-skin-muted'}`}>
                    <Server size={16} />
                </div>
                <div className="flex flex-col">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isEnabled ? 'text-skin-text' : 'text-skin-muted'}`}>{provider}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-emerald-500' : 'bg-red-500'} ${hasKey ? 'shadow-[0_0_5px_#10b981]' : ''}`}></div>
                        <span className="text-[8px] font-mono text-skin-muted uppercase">{hasKey ? 'KEY_DETECTED' : 'NO_KEY_FOUND'}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <span className={`text-[8px] font-bold uppercase tracking-wider ${isEnabled ? 'text-accent' : 'text-skin-muted'}`}>
                    {isEnabled ? 'ACTIVE' : 'OFF'}
                </span>
                <button 
                    onClick={onToggle}
                    className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 relative ${isEnabled ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-all duration-300 ${isEnabled ? 'left-[20px]' : 'left-1'}`} />
                </button>
            </div>
        </div>
    );
};

// --- MAIN VIEW ---

const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
    // ... (State hooks same as before) ...
    const { lockVault } = useVault();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Config State - REACTIVE
    const [persistedLanguage, setPersistedLanguage] = useLocalStorage<LanguageCode>('app_language', 'id');
    const [persistedTheme, setPersistedTheme] = useLocalStorage<string>('app_theme', 'cyan');
    const [persistedColorScheme, setPersistedColorScheme] = useLocalStorage<'system' | 'light' | 'dark'>('app_color_scheme', 'system');
    
    // User Persona
    const [userPersona, setUserPersona] = useLocalStorage('user_persona_config', DEFAULT_USER_PERSONA);

    // Voices
    const [persistedHanisahVoice, setPersistedHanisahVoice] = useLocalStorage<string>('hanisah_voice', 'Zephyr');
    const [persistedStoicVoice, setPersistedStoicVoice] = useLocalStorage<string>('stoic_voice', 'Fenrir');

    // System Prompts (The Brains)
    const [hanisahPrompt, setHanisahPrompt] = useLocalStorage<string>('hanisah_system_prompt', '');
    const [stoicPrompt, setStoicPrompt] = useLocalStorage<string>('stoic_system_prompt', '');

    // Tools Configuration
    const [persistedHanisahTools, setPersistedHanisahTools] = useLocalStorage<ToolConfig>('hanisah_tools_config', { search: true, vault: true, visual: true });
    const [persistedStoicTools, setPersistedStoicTools] = useLocalStorage<ToolConfig>('stoic_tools_config', { search: true, vault: true, visual: false });
    
    // API Visibility Configuration
    const [persistedVisibility, setPersistedVisibility] = useLocalStorage<Record<string, boolean>>('provider_visibility', {});

    // Biometric Toggle
    const [persistedBioEnabled, setPersistedBioEnabled] = useLocalStorage<boolean>('bio_auth_enabled', false);

    // Local UI State (For buffering changes before "Saving")
    const [language, setLanguage] = useState(persistedLanguage);
    const [theme, setTheme] = useState(persistedTheme);
    const [colorScheme, setColorScheme] = useState(persistedColorScheme);
    const [hanisahVoice, setHanisahVoice] = useState(persistedHanisahVoice);
    const [stoicVoice, setStoicVoice] = useState(persistedStoicVoice);
    const [hanisahTools, setHanisahTools] = useState(persistedHanisahTools);
    const [stoicTools, setStoicTools] = useState(persistedStoicTools);
    const [localPersona, setLocalPersona] = useState(userPersona);
    const [localVisibility, setLocalVisibility] = useState(persistedVisibility);
    const [bioEnabled, setBioEnabled] = useState(persistedBioEnabled);

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isTestingVoice, setIsTestingVoice] = useState(false);
    const [isGeneratingBio, setIsGeneratingBio] = useState(false);
    
    // Security State
    const [newPin, setNewPin] = useState('');
    const [isPinConfigured, setIsPinConfigured] = useState(isSystemPinConfigured());
    const [showPinInput, setShowPinInput] = useState(false);
    
    // Editor Modal State
    const [editingPersona, setEditingPersona] = useState<'hanisah' | 'stoic' | null>(null);

    // Share Modal
    const [showShareQR, setShowShareQR] = useState(false);

    // Key Status State
    const [keyStatuses, setKeyStatuses] = useState<ProviderStatus[]>([]);

    useEffect(() => {
        setKeyStatuses(KEY_MANAGER.getAllProviderStatuses());
    }, []);

    // Text Resources (Dynamic)
    const t = TRANSLATIONS[language].settings;
    const defaultPrompts = TRANSLATIONS[language].prompts;

    const themeOptions = Object.entries(THEME_COLORS).map(([id, color]) => ({ id, color }));

    const handleToggleBio = async () => {
        if (!bioEnabled) {
            // Turning ON: Must register
            try {
                const result = await BiometricService.register(localPersona.nama || 'Operator');
                if (result) {
                    setBioEnabled(true);
                    alert("Biometric Security Activated.");
                }
            } catch(e: any) {
                alert(`Biometric Setup Failed: ${e.message || "Not Supported"}`);
                setBioEnabled(false);
            }
        } else {
            setBioEnabled(false);
        }
    };

    const handleSave = async () => {
        debugService.logAction(UI_REGISTRY.SETTINGS_BTN_SAVE, FN_REGISTRY.SAVE_CONFIG, 'START');
        setIsSaving(true);
        
        if (newPin) {
            if (newPin.length < 4) {
                alert("PIN must be at least 4 digits.");
                setIsSaving(false);
                return;
            }
            await setSystemPin(newPin);
            setIsPinConfigured(true);
            setNewPin('');
            setShowPinInput(false);
        }

        // Instant Save - No Artificial Delay
        setPersistedLanguage(language);
        setPersistedTheme(theme);
        setPersistedColorScheme(colorScheme);
        setPersistedHanisahVoice(hanisahVoice);
        setPersistedStoicVoice(stoicVoice);
        setPersistedHanisahTools(hanisahTools);
        setPersistedStoicTools(stoicTools);
        setUserPersona(localPersona);
        setPersistedVisibility(localVisibility);
        setPersistedBioEnabled(bioEnabled);
        
        localStorage.removeItem('user_api_keys'); 
        
        KEY_MANAGER.refreshPools(); 

        if ((!hanisahTools.vault && persistedHanisahTools.vault) || (!stoicTools.vault && persistedStoicTools.vault)) {
            lockVault();
        }
        
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    const handleGenerateBio = async () => {
        if (!localPersona.nama.trim()) {
            alert("Please enter a name/codename first.");
            return;
        }
        setIsGeneratingBio(true);
        try {
            const prompt = `Create a short, cool, bio for a user named "${localPersona.nama}". Focus on productivity and stoicism. Max 3 sentences. Language: ${TRANSLATIONS[language].meta.label}.`;
            const result = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview', 'Bio Generator');
            if (result.text) {
                setLocalPersona({ ...localPersona, bio: result.text.trim() });
            }
        } catch(e) {
            console.error(e);
        } finally {
            setIsGeneratingBio(false);
        }
    };

    const handleBackup = () => {
        debugService.logAction(UI_REGISTRY.SETTINGS_BTN_BACKUP, FN_REGISTRY.BACKUP_DATA, 'EXPORT');
        const data = { ...localStorage };
        delete data['user_api_keys'];
        delete data['sys_vault_hash'];
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `istoic_full_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    };

    const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        debugService.logAction(UI_REGISTRY.SETTINGS_BTN_RESTORE, FN_REGISTRY.RESTORE_DATA, 'IMPORT');
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const jsonStr = event.target?.result as string;
                const data = JSON.parse(jsonStr);
                
                if (typeof data !== 'object' || data === null) throw new Error("Invalid JSON.");

                if (confirm("WARNING: This will overwrite ALL local data. Proceed?")) {
                    localStorage.clear();
                    Object.keys(data).forEach(key => localStorage.setItem(key, data[key]));
                    debugService.log('INFO', 'SETTINGS', 'RESTORE_SUCCESS', 'System restored.');
                    window.location.reload();
                }
            } catch (err) {
                alert("Invalid backup file.");
            }
        };
        reader.readAsText(file);
    };

    const handleTestHanisahVoice = async () => {
        if (isTestingVoice) return;
        setIsTestingVoice(true);
        try {
            await speakWithHanisah(`Neural link testing successful using ${hanisahVoice} module. Voice systems nominal.`, hanisahVoice);
        } catch (e) {
            alert("Voice synthesis failed.");
        } finally {
            setIsTestingVoice(false);
        }
    };

    const openKernelStream = () => {
        debugService.logAction(UI_REGISTRY.MECH_BTN_SCAN, FN_REGISTRY.NAVIGATE_TO_FEATURE, 'KERNEL_STREAM');
        if (onNavigate) onNavigate('system');
    };

    const toggleProvider = (provider: string) => {
        setLocalVisibility(prev => ({
            ...prev,
            [provider]: prev[provider] === undefined ? false : !prev[provider]
        }));
    };

    const isProviderEnabled = (p: string) => localVisibility[p] !== false;
    
    const hasProviderKey = (p: string) => {
        const status = keyStatuses.find(k => k.id.includes(p));
        return status ? status.keyCount > 0 : false;
    };

    return (
        <div className="min-h-full flex flex-col px-4 pb-40 pt-[calc(env(safe-area-inset-top)+2rem)] md:px-12 md:pt-16 lg:px-16 animate-fade-in overflow-x-hidden bg-noise">
             
             {/* CONFIGURATION OVERLAY */}
             {isSaving && (
                 <div className="fixed inset-0 z-[9999] bg-[#050505]/90 backdrop-blur-xl flex flex-col items-center justify-center animate-fade-in">
                     <div className="relative">
                         <div className="w-32 h-32 rounded-full border-4 border-accent/20 border-t-accent animate-spin shadow-[0_0_50px_var(--accent-glow)]"></div>
                         <Activity size={32} className="text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                     </div>
                     <h2 className="mt-8 text-2xl font-black text-white uppercase italic tracking-tighter animate-pulse">UPDATING SYSTEM...</h2>
                     <p className="mt-2 text-xs font-mono text-accent uppercase tracking-[0.3em]">APPLYING CHANGES</p>
                 </div>
             )}

             {/* EDIT MODAL */}
             <PromptEditorModal 
                isOpen={!!editingPersona}
                onClose={() => setEditingPersona(null)}
                persona={editingPersona || 'hanisah'}
                currentPrompt={editingPersona === 'hanisah' ? (hanisahPrompt || defaultPrompts.hanisah) : (stoicPrompt || defaultPrompts.stoic)}
                onSave={(val) => editingPersona === 'hanisah' ? setHanisahPrompt(val) : setStoicPrompt(val)}
                onReset={() => editingPersona === 'hanisah' ? setHanisahPrompt('') : setStoicPrompt('')}
             />

             {/* SHARE APP MODAL */}
             {showShareQR && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowShareQR(false)}>
                    <div className="bg-[#09090b] border border-white/10 p-8 rounded-[32px] max-w-sm w-full flex flex-col items-center gap-6 shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowShareQR(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all"><X size={16}/></button>
                        <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                            <QrCode size={16} /> SCAN_TO_ACCESS
                        </h3>
                        <div className="p-4 bg-white rounded-2xl shadow-inner">
                            <SharedQRCode value={window.location.origin} size={240} />
                        </div>
                        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                            <span className="text-[9px] text-neutral-500 uppercase tracking-widest block mb-1">APP_URL</span>
                            <span className="text-xs font-mono text-white select-all">{window.location.origin}</span>
                        </div>
                    </div>
                </div>
             )}

             <div className="max-w-6xl mx-auto w-full bg-skin-card rounded-[32px] md:rounded-[48px] shadow-2xl border border-skin-border p-6 md:p-12 space-y-12 md:space-y-16 relative ring-1 ring-skin-border">
                
                {/* Unified Header */}
                <header className="space-y-4 md:space-y-6 relative z-10 border-b border-skin-border pb-6 md:pb-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="px-3 py-1 bg-accent/10 border border-accent/20 tech-mono text-[9px] font-black text-accent tracking-[0.3em] shadow-[0_0_15px_rgba(var(--accent-rgb),0.15)]">CONFIG_V25.0</div>
                            <div className="h-[1px] w-12 bg-skin-border hidden sm:block"></div>
                            <span className="text-skin-muted tech-mono text-[9px] font-black tracking-widest flex items-center gap-2">
                                <Activity size={12} className="text-green-500 animate-pulse" /> SYSTEM_READY
                            </span>
                        </div>
                        <button onClick={() => setShowShareQR(true)} className="flex items-center gap-2 px-4 py-2 bg-skin-surface border border-skin-border rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-skin-surface-hover hover:border-accent/30 transition-all text-skin-muted hover:text-skin-text">
                            <QrCode size={12} /> OPEN_ON_MOBILE
                        </button>
                    </div>
                    <div>
                        <h2 className="text-[12vw] xl:text-[7rem] heading-heavy text-skin-text leading-[0.85] tracking-tighter uppercase drop-shadow-sm">
                            SYSTEM <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-500 animate-gradient-text">SETTINGS</span>
                        </h2>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                    <div className="space-y-12">
                        
                        {/* GENERAL SETTINGS */}
                        <SettingsSection title={t.title} icon={<Globe size={18} />}>
                            <SettingsItem 
                                label={t.lang_label} desc={t.lang_desc}
                                icon={<Languages size={22}/>}
                                action={
                                    <div className="flex bg-skin-surface-hover p-1 rounded-2xl border border-skin-border w-full md:w-auto">
                                        {[ { id: 'id', label: 'ID' }, { id: 'en', label: 'EN' }, { id: 'bn', label: 'BN' } ].map(lang => (
                                            <button key={lang.id} onClick={() => { debugService.logAction(UI_REGISTRY.SETTINGS_BTN_LANG_ID, FN_REGISTRY.SET_LANGUAGE, lang.id); setLanguage(lang.id as any); }} className={`min-h-[44px] flex-1 px-4 md:px-5 text-[10px] font-black tracking-widest rounded-xl transition-all ${language === lang.id ? 'bg-skin-card text-accent shadow-md scale-100' : 'text-skin-muted hover:text-skin-text'}`}>
                                                {lang.label}
                                            </button>
                                        ))}
                                    </div>
                                }
                            />
                            <SettingsItem 
                                label={t.theme_label} desc={t.theme_desc}
                                icon={<Palette size={22}/>}
                                action={
                                    <div className="flex bg-skin-surface-hover p-1 rounded-2xl border border-skin-border w-full md:w-auto">
                                        {['system', 'light', 'dark'].map(s => (
                                            <button key={s} onClick={() => { debugService.logAction(UI_REGISTRY.SETTINGS_BTN_THEME_SYSTEM, FN_REGISTRY.SET_THEME_MODE, s); setColorScheme(s as any); }} className={`min-h-[44px] flex-1 px-4 md:px-5 text-[9px] font-black uppercase rounded-xl transition-all ${colorScheme === s ? 'bg-skin-card text-accent shadow-md' : 'text-skin-muted hover:text-skin-text'}`}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                }
                            />
                            <SettingsItem 
                                label="ACCENT COLOR" desc="Choose your visual signature."
                                icon={<Monitor size={22}/>}
                                action={
                                    <div className="flex flex-wrap justify-end gap-3 max-w-[240px]">
                                        {themeOptions.map(opt => (
                                            <button key={opt.id} onClick={() => setTheme(opt.id)} className={`w-10 h-10 rounded-2xl border-2 transition-all ${theme === opt.id ? 'border-accent shadow-[0_0_20px_var(--accent-glow)] scale-110' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`} style={{ backgroundColor: opt.color }} />
                                        ))}
                                    </div>
                                }
                            />
                        </SettingsSection>

                        {/* SECURITY PROTOCOLS */}
                        <SettingsSection title="SECURITY_SETTINGS" icon={<Shield size={18} />}>
                            <SettingsItem 
                                label="VAULT_ENCRYPTION" desc={isPinConfigured ? "ENCRYPTED" : "UNSECURED"}
                                icon={isPinConfigured ? <Lock size={22} className="text-emerald-500"/> : <Unlock size={22} className="text-red-500"/>}
                                action={
                                    <div className="flex flex-col gap-3 w-full md:w-72">
                                        {showPinInput ? (
                                            <div className="relative animate-fade-in">
                                                <input 
                                                    type="password"
                                                    placeholder="SET_NEW_PIN"
                                                    value={newPin}
                                                    onChange={(e) => setNewPin(e.target.value)}
                                                    className="w-full bg-skin-surface border border-skin-border rounded-2xl px-4 py-3 text-xs font-mono text-skin-text focus:outline-none focus:border-accent/50 text-center tracking-[0.5em] transition-all"
                                                    maxLength={10}
                                                    autoFocus
                                                />
                                                <button onClick={() => setShowPinInput(false)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-skin-muted hover:text-red-500 transition-colors"><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setShowPinInput(true)} 
                                                className={`w-full py-3 rounded-2xl border flex items-center justify-center gap-2 transition-all ${isPinConfigured ? 'bg-skin-surface-hover text-skin-muted border-transparent hover:border-accent/20' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'}`}
                                            >
                                                {isPinConfigured ? <Edit3 size={14}/> : <AlertTriangle size={14}/>}
                                                <span className="text-[10px] font-black uppercase tracking-widest">{isPinConfigured ? "CHANGE_PIN" : "CONFIGURE_PIN"}</span>
                                            </button>
                                        )}
                                        <p className="text-[8px] text-skin-muted text-center font-mono">
                                            {isPinConfigured ? "SECURED_SHA256" : "WARNING: DATA EXPOSED"}
                                        </p>
                                    </div>
                                }
                            />
                            
                            <SettingsItem 
                                label="BIOMETRIC_ACCESS" desc="Hardware Authenticator (FaceID/TouchID)."
                                icon={<ScanFace size={22}/>}
                                action={
                                    <div className="flex items-center gap-3">
                                        <span className={`text-[8px] font-bold uppercase tracking-wider ${bioEnabled ? 'text-accent' : 'text-skin-muted'}`}>
                                            {bioEnabled ? 'ACTIVE' : 'OFF'}
                                        </span>
                                        <button 
                                            onClick={handleToggleBio}
                                            className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 relative ${bioEnabled ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-all duration-300 ${bioEnabled ? 'left-[20px]' : 'left-1'}`} />
                                        </button>
                                    </div>
                                }
                            />
                        </SettingsSection>

                        {/* IDENTITY MATRIX */}
                        <SettingsSection title={t.identity_title || "USER PROFILE"} icon={<UserCheck size={18} />}>
                            <div className="p-2 space-y-2">
                                <div className="p-6 bg-skin-card rounded-[24px] border border-skin-border space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest pl-1 flex items-center gap-2">
                                            <User size={12}/> {t.user_name || "NAME"}
                                        </label>
                                        <input type="text" value={localPersona.nama} onChange={(e) => setLocalPersona({...localPersona, nama: e.target.value})} className="w-full bg-skin-surface border border-skin-border rounded-2xl px-5 py-4 text-sm font-bold text-skin-text focus:outline-none focus:border-accent/50 focus:bg-skin-card transition-all"/>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[9px] font-black text-skin-muted uppercase tracking-widest pl-1 flex items-center gap-2">
                                                <Info size={12}/> {t.user_bio || "BIO CONTEXT"}
                                            </label>
                                            <button 
                                                onClick={handleGenerateBio} 
                                                disabled={isGeneratingBio}
                                                className="text-[9px] font-black uppercase tracking-widest text-accent flex items-center gap-1 hover:underline disabled:opacity-50"
                                            >
                                                {isGeneratingBio ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} AI_AUTO_GEN
                                            </button>
                                        </div>
                                        <textarea value={localPersona.bio} onChange={(e) => setLocalPersona({...localPersona, bio: e.target.value})} className="w-full h-32 bg-skin-surface border border-skin-border rounded-2xl px-5 py-4 text-xs font-medium text-skin-text focus:outline-none focus:border-accent/50 focus:bg-skin-card transition-all resize-none leading-relaxed custom-scroll"/>
                                    </div>
                                </div>
                            </div>
                        </SettingsSection>

                        {/* API KEYS / NEURAL UPLINKS MATRIX */}
                        <SettingsSection title="API CONNECTIONS" icon={<Network size={18} />}>
                            <div className="p-2 space-y-2">
                                <div className="p-4 bg-skin-surface rounded-[24px] border border-skin-border space-y-3">
                                    <p className="text-[9px] text-skin-muted font-bold uppercase tracking-widest px-1 pb-1 flex justify-between">
                                        <span>MANAGE API STATUS</span>
                                        <span className="opacity-50">KEYS READ FROM ENV</span>
                                    </p>
                                    <ProviderToggleRow provider="GEMINI" isEnabled={isProviderEnabled('GEMINI')} hasKey={hasProviderKey('GEMINI')} onToggle={() => toggleProvider('GEMINI')} />
                                    <ProviderToggleRow provider="GROQ" isEnabled={isProviderEnabled('GROQ')} hasKey={hasProviderKey('GROQ')} onToggle={() => toggleProvider('GROQ')} />
                                    <ProviderToggleRow provider="OPENAI" isEnabled={isProviderEnabled('OPENAI')} hasKey={hasProviderKey('OPENAI')} onToggle={() => toggleProvider('OPENAI')} />
                                    <ProviderToggleRow provider="DEEPSEEK" isEnabled={isProviderEnabled('DEEPSEEK')} hasKey={hasProviderKey('DEEPSEEK')} onToggle={() => toggleProvider('DEEPSEEK')} />
                                    <ProviderToggleRow provider="MISTRAL" isEnabled={isProviderEnabled('MISTRAL')} hasKey={hasProviderKey('MISTRAL')} onToggle={() => toggleProvider('MISTRAL')} />
                                    <ProviderToggleRow provider="HUGGINGFACE" isEnabled={isProviderEnabled('HUGGINGFACE')} hasKey={hasProviderKey('HUGGINGFACE')} onToggle={() => toggleProvider('HUGGINGFACE')} />
                                    <ProviderToggleRow provider="ELEVENLABS" isEnabled={isProviderEnabled('ELEVENLABS')} hasKey={hasProviderKey('ELEVENLABS')} onToggle={() => toggleProvider('ELEVENLABS')} />
                                </div>
                            </div>
                        </SettingsSection>
                    </div>

                    <div className="space-y-12">
                        <SettingsSection title="ASSISTANT_PERSONALITY" icon={<Cpu size={18} />}>
                            <div className="space-y-6 p-2">
                                {/* HANISAH CONFIG */}
                                <div className="p-6 md:p-8 bg-gradient-to-br from-orange-600/5 to-transparent rounded-[32px] border border-orange-500/10 space-y-6 group relative overflow-hidden shadow-sm hover:shadow-lg hover:border-orange-500/30 transition-all">
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-orange-600 text-white rounded-[20px] flex items-center justify-center shadow-lg shadow-orange-500/30"><Flame size={28} fill="currentColor" /></div>
                                            <div>
                                                <h4 className="text-xl font-black italic text-skin-text uppercase tracking-tighter">HANISAH</h4>
                                                <p className="text-[8px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest mt-1">Creative Partner</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingPersona('hanisah')} className="p-3 bg-skin-card rounded-2xl border border-skin-border text-skin-muted hover:text-orange-500 transition-all hover:scale-105 active:scale-95 shadow-sm" title="Edit Persona Matrix">
                                                <Edit3 size={18} />
                                            </button>
                                            <button onClick={handleTestHanisahVoice} disabled={isTestingVoice} className="p-3 bg-skin-card rounded-2xl border border-skin-border text-orange-500 hover:bg-orange-600 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-sm">
                                                {isTestingVoice ? <RefreshCw className="animate-spin" size={18} /> : <Play size={18} fill="currentColor" />}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex bg-skin-surface-hover p-1.5 rounded-[20px] border border-skin-border">
                                            {['Zephyr', 'Kore', 'Hanisah'].map(v => (
                                                <button key={v} onClick={() => setHanisahVoice(v)} className={`flex-1 min-h-[40px] text-[9px] font-black uppercase rounded-2xl transition-all ${hanisahVoice === v ? 'bg-orange-600 text-white shadow-md transform scale-100' : 'text-skin-muted hover:text-skin-text'}`}>{v}</button>
                                            ))}
                                        </div>
                                        <div className="flex flex-col gap-2 pt-2">
                                            <ToolRow label="WEB_SEARCH" description="Real-time grounding." icon={<Globe />} isActive={hanisahTools.search} activeColor="bg-orange-600" onClick={() => setHanisahTools(prev => ({...prev, search: !prev.search}))} />
                                            <ToolRow label="VAULT_ACCESS" description="Memory permission." icon={<DatabaseZap />} isActive={hanisahTools.vault} activeColor="bg-orange-600" badge="SECURE" onClick={() => setHanisahTools(prev => ({...prev, vault: !prev.vault}))} />
                                            <ToolRow label="VISUAL_CORTEX" description="Image generation." icon={<ImageIcon />} isActive={hanisahTools.visual} activeColor="bg-orange-600" onClick={() => setHanisahTools(prev => ({...prev, visual: !prev.visual}))} />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* STOIC CONFIG */}
                                <div className="p-6 md:p-8 bg-gradient-to-br from-blue-600/5 to-transparent rounded-[32px] border border-blue-500/10 space-y-6 group relative overflow-hidden shadow-sm hover:shadow-lg hover:border-blue-500/30 transition-all">
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-blue-600 text-white rounded-[20px] flex items-center justify-center shadow-lg shadow-blue-500/30"><Brain size={28} fill="currentColor" /></div>
                                            <div>
                                                <h4 className="text-xl font-black italic text-skin-text uppercase tracking-tighter">LOGIC CORE</h4>
                                                <p className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1">Analytical Engine</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingPersona('stoic')} className="p-3 bg-skin-card rounded-2xl border border-skin-border text-skin-muted hover:text-blue-500 transition-all hover:scale-105 active:scale-95 shadow-sm" title="Edit Persona Matrix">
                                            <Edit3 size={18} />
                                        </button>
                                    </div>
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex bg-skin-surface-hover p-1.5 rounded-[20px] border border-skin-border">
                                            {['Fenrir', 'Puck'].map(v => (
                                                <button key={v} onClick={() => setStoicVoice(v)} className={`flex-1 min-h-[40px] text-[9px] font-black uppercase rounded-2xl transition-all ${stoicVoice === v ? 'bg-blue-600 text-white shadow-md transform scale-100' : 'text-skin-muted hover:text-skin-text'}`}>{v}</button>
                                            ))}
                                        </div>
                                        <div className="flex flex-col gap-2 pt-2">
                                            <ToolRow label="LOGIC_ONLY" description="No external tools." icon={<Shield />} isActive={!stoicTools.search && !stoicTools.visual} activeColor="bg-blue-600" onClick={() => setStoicTools({ search: false, vault: stoicTools.vault, visual: false })} />
                                            <ToolRow label="VAULT_ACCESS" description="Memory permission." icon={<DatabaseZap />} isActive={stoicTools.vault} activeColor="bg-blue-600" badge="SECURE" onClick={() => setStoicTools(prev => ({...prev, vault: !prev.vault}))} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SettingsSection>

                        {/* DATA GOVERNANCE */}
                        <SettingsSection title={t.data_title || "DATA MANAGEMENT"} icon={<HardDrive size={18} />}>
                            <div className="p-2 grid grid-cols-2 gap-3">
                                <button onClick={handleBackup} className="p-6 bg-skin-card border border-skin-border rounded-[24px] flex flex-col items-center justify-center gap-4 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group shadow-sm hover:shadow-lg active:scale-95">
                                    <div className="w-12 h-12 rounded-[18px] bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform"><Download size={24} /></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{t.backup || "BACKUP (JSON)"}</span>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="p-6 bg-skin-card border border-skin-border rounded-[24px] flex flex-col items-center justify-center gap-4 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group shadow-sm hover:shadow-lg active:scale-95">
                                    <div className="w-12 h-12 rounded-[18px] bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform"><Upload size={24} /></div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{t.restore || "RESTORE DATA"}</span>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="application/json" onChange={handleRestore} />
                                </button>
                            </div>
                        </SettingsSection>

                        {/* DEVELOPER MATRIX */}
                        <SettingsSection title="DEVELOPER TOOLS" icon={<Terminal size={18} />}>
                            <div className="p-4 bg-[#121214] rounded-[24px] border border-white/10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-black text-white uppercase tracking-wider">Kernel Stream</h4>
                                        <p className="text-[9px] text-neutral-500">Access full system diagnostics.</p>
                                    </div>
                                    <button onClick={openKernelStream} className="px-4 py-2 bg-white/10 hover:bg-accent hover:text-black text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95">OPEN_KERNEL_STREAM</button>
                                </div>
                                <div className="h-[1px] bg-white/5"></div>
                                <button onClick={() => { debugService.runSelfDiagnosis(KEY_MANAGER); alert("Diagnosis Initiated. Check Kernel Stream."); }} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-mono text-neutral-400 hover:text-white transition-all uppercase tracking-widest border border-white/5 active:scale-95">RUN_SELF_DIAGNOSIS_PROTOCOL</button>
                            </div>
                        </SettingsSection>
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-skin-card/95 backdrop-blur-xl border-t border-skin-border flex justify-center z-50 md:sticky md:bottom-0 md:bg-transparent md:backdrop-filter-none md:border-none md:p-0 md:pt-10">
                    <div className="flex gap-4 w-full max-w-4xl">
                        <button onClick={() => { debugService.logAction(UI_REGISTRY.SETTINGS_BTN_RESET, FN_REGISTRY.RESET_SYSTEM, 'CONFIRM'); if(confirm("Hapus semua data kognitif permanen?")) { localStorage.clear(); window.location.reload(); } }} className="w-16 md:w-20 py-4 md:py-6 rounded-[24px] border border-red-500/20 bg-red-500/5 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95">
                            <Trash2 size={20} />
                        </button>
                        <button onClick={handleSave} disabled={isSaving} className={`flex-1 py-4 md:py-6 rounded-[24px] font-black uppercase text-[12px] md:text-[14px] tracking-[0.3em] flex items-center justify-center gap-4 transition-all shadow-xl hover:scale-[1.01] active:scale-95 ${saveSuccess ? 'bg-emerald-600 text-white shadow-emerald-500/30' : 'bg-accent text-black shadow-[0_0_30px_var(--accent-glow)]'}`}>
                            {isSaving ? <Loader2 className="animate-spin" size={24} /> : saveSuccess ? <CheckCircle2 size={24} /> : <Zap size={24} fill="currentColor" />}
                            {isSaving ? "SAVING..." : saveSuccess ? t.saved || "UPDATED" : t.save}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;