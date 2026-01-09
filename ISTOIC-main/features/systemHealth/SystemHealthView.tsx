
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Activity, Terminal, ShieldCheck, Trash2, Network, Server, Database,
    Wifi, Power, Bug, Monitor, Volume2, 
    ChevronRight, Play, Pause, ArrowRight, Key, RefreshCw, Stethoscope, Search, CheckCircle2, HardDrive
} from 'lucide-react';
import { debugService } from '../../services/debugService';
import { KEY_MANAGER, type ProviderStatus } from '../../services/geminiService';
import { HANISAH_KERNEL } from '../../services/melsaKernel';
import { speakWithHanisah } from '../../services/elevenLabsService';
import { type LogEntry } from '../../types';
import Markdown from 'react-markdown';
import { executeMechanicTool } from '../mechanic/mechanicTools';
import { IntegrityMatrix } from './components/IntegrityMatrix';
import { useFeatures } from '../../contexts/FeatureContext';
import useLocalStorage from '../../hooks/useLocalStorage';

// --- HELPER: JSON TREE VIEW ---
const JsonTree: React.FC<{ data: any; level?: number }> = ({ data, level = 0 }) => {
    const [expanded, setExpanded] = useState(level < 1);
    if (typeof data !== 'object' || data === null) {
        const valueColor = typeof data === 'string' ? 'text-emerald-400' : typeof data === 'number' ? 'text-orange-400' : 'text-purple-400';
        return <span className={`${valueColor} break-all`}>{JSON.stringify(data)}</span>;
    }
    const isArray = Array.isArray(data);
    const keys = Object.keys(data);
    const isEmpty = keys.length === 0;
    return (
        <div className="font-mono text-[10px] leading-relaxed ml-3 border-l border-white/10 pl-1">
            <div className={`flex items-center gap-1 cursor-pointer hover:text-white ${isEmpty ? 'opacity-50 cursor-default' : 'text-neutral-500'}`} onClick={() => !isEmpty && setExpanded(!expanded)}>
                {!isEmpty && (expanded ? "▼" : "▶")} <span className="text-neutral-500">{isArray ? '[' : '{'}</span>
                {!expanded && !isEmpty && <span className="text-neutral-400">...</span>}
                {isEmpty && <span className="text-neutral-500">{isArray ? ']' : '}'}</span>}
                {!isEmpty && <span className="text-neutral-400 text-[8px] ml-2">({keys.length})</span>}
            </div>
            {expanded && !isEmpty && (
                <div className="my-0.5">
                    {keys.map((key) => (
                        <div key={key} className="flex items-start"><span className="text-[var(--accent-color)] opacity-70 mr-2 shrink-0">{key}:</span><JsonTree data={data[key]} level={level + 1} /></div>
                    ))}
                    <div className="text-neutral-500">{isArray ? ']' : '}'}</div>
                </div>
            )}
        </div>
    );
};

export const SystemHealthView: React.FC = () => {
    // Core Data
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [health, setHealth] = useState<any>({ avgLatency: 0, memoryMb: 0, errorCount: 0 });
    const [providers, setProviders] = useState<ProviderStatus[]>([]);
    const { features } = useFeatures();
    
    // UI State
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'KERNEL_STREAM' | 'UI_MATRIX' | 'MEMORY'>('KERNEL_STREAM');
    const [isScanning, setIsScanning] = useState(false);
    const [hanisahDiagnosis, setHanisahDiagnosis] = useState<string | null>(null);
    const [storageUsage, setStorageUsage] = useState({ used: 0, percent: 0 });
    const [realPing, setRealPing] = useState<number | null>(null);
    
    // Hydraulic Rotation Animation
    const [isRotatingKeys, setIsRotatingKeys] = useState(false);

    // Terminal State
    const [logFilter, setLogFilter] = useState<string>('ALL');
    const [logSearch, setLogSearch] = useState<string>('');
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    
    // PERSISTENT STREAM FREEZE STATE
    const [isStreamFrozen, setIsStreamFrozen] = useLocalStorage<boolean>('kernel_stream_paused', false);
    
    const [cliInput, setCliInput] = useState('');
    const logEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Memory State
    const [storageKeys, setStorageKeys] = useState<string[]>([]);
    const [selectedStorageKey, setSelectedStorageKey] = useState<string | null>(null);
    const [storageValue, setStorageValue] = useState<any>(null);

    const executeRepair = async (action: string) => {
        debugService.log('INFO', 'MECHANIC', 'FIX_EXEC', `Initiating protocol: ${action}`);
        
        if (action === 'HARD_RESET') {
            if(confirm("PERINGATAN: System Reboot akan merefresh halaman.")) window.location.reload();
            return;
        }

        await new Promise(r => setTimeout(r, 800));
        const result = await executeMechanicTool({ args: { action } });
        debugService.log('INFO', 'MECHANIC', 'FIX_RESULT', result);
        
        if (action === 'REFRESH_KEYS') {
            setProviders(KEY_MANAGER.getAllProviderStatuses());
        } else if (action === 'CLEAR_LOGS') {
            setLogs([]);
            debugService.clear();
        } else if (action === 'OPTIMIZE_MEMORY') {
            calcStorage();
            setHealth(debugService.getSystemHealth());
        }
    };

    const handleHydraRefresh = async () => {
        setIsRotatingKeys(true);
        await executeRepair('REFRESH_KEYS');
        setTimeout(() => setIsRotatingKeys(false), 1000);
    };

    const runHanisahDiagnosis = async () => {
        setIsScanning(true);
        setHanisahDiagnosis(null);
        try {
            debugService.log('INFO', 'MECHANIC', 'SCAN_INIT', 'Running full system diagnostics...');
            const toolResultJson = await executeMechanicTool({ args: { action: 'GET_DIAGNOSTICS' } });
            
            const prompt = `[ROLE: HANISAH_SYSTEM_MECHANIC]\nAnalisa data telemetri (CPU, RAM, Latency).\nBerikan laporan performa sistem gaya Cyberpunk.\n\n[RAW_DATA]\n${toolResultJson}\n\nFORMAT:\n1. **SYSTEM INTEGRITY**: (SCORE %)\n2. **METRICS SUMMARY**: (CPU/Mem/Net Status)\n3. **ANOMALIES**: (List - be specific)\n4. **OPTIMIZATION**: (Actionable steps)`;
            
            // Fix: Pass empty array for contextNotes (3rd arg) to satisfy Note[] type
            const response = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview', []);
            setHanisahDiagnosis(response.text || "Diagnostic matrix failed to render.");
            debugService.log('INFO', 'MECHANIC', 'SCAN_COMPLETE', 'Diagnosis generated successfully.');
        } catch (e: any) {
            setHanisahDiagnosis(`⚠️ Neural Link Interrupted. ${e.message}`);
            debugService.log('ERROR', 'MECHANIC', 'SCAN_FAIL', e.message);
        } finally {
            setIsScanning(false);
        }
    };

    // --- REALTIME & STREAM CONTROL LOGIC ---
    useEffect(() => {
        // 1. Initial Data Fetch (Always load current state on mount)
        setLogs(debugService.getLogs()); 
        calcStorage();
        updateStorageList();

        // 2. Log Subscription with Freeze Capability
        const unsubscribeLogs = debugService.subscribe((newLogs) => {
            if (!isStreamFrozen) {
                setLogs(newLogs);
            }
        });
        
        // 3. Auto Diagnostics Interval (Strict Toggle Control)
        let diagInterval: any = null;

        if (features.AUTO_DIAGNOSTICS) {
            // Immediate update when toggled ON
            setHealth(debugService.getSystemHealth());
            setProviders(KEY_MANAGER.getAllProviderStatuses());
            
            // Start Interval
            diagInterval = setInterval(() => {
                setHealth(debugService.getSystemHealth());
                setProviders(KEY_MANAGER.getAllProviderStatuses());
                calcStorage();
            }, 3000);
        }

        return () => { 
            unsubscribeLogs();
            if (diagInterval) clearInterval(diagInterval);
        };
    }, [features.AUTO_DIAGNOSTICS, isStreamFrozen]); 

    // Toggle Freeze Logic
    const toggleStreamFreeze = () => {
        if (isStreamFrozen) {
            // Unfreezing: Immediately sync with latest backend logs
            setLogs(debugService.getLogs());
            setIsAutoScroll(true);
        }
        setIsStreamFrozen(!isStreamFrozen);
    };

    // Auto-scroll Logic
    useEffect(() => {
        if (activeTab === 'KERNEL_STREAM' && isAutoScroll && !isStreamFrozen && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, activeTab, isAutoScroll, isStreamFrozen]);

    const calcStorage = () => {
        try {
            let total = 0;
            for (const x in localStorage) {
                if (!localStorage.hasOwnProperty(x)) continue;
                total += ((localStorage[x].length + x.length) * 2);
            }
            setStorageUsage({ used: total, percent: Math.min((total / (5 * 1024 * 1024)) * 100, 100) });
        } catch(e) {}
    };

    const updateStorageList = () => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('app_') || k === 'chat_threads' || k === 'notes' || k.includes('config'));
        setStorageKeys(keys.sort());
    };

    const loadStorageValue = (key: string) => {
        setSelectedStorageKey(key);
        try {
            const raw = localStorage.getItem(key);
            setStorageValue(raw ? JSON.parse(raw) : null);
        } catch (e) {
            setStorageValue("Raw String: " + localStorage.getItem(key));
        }
    };

    const runPingTest = async () => {
        setRealPing(null);
        const start = Date.now();
        try {
            await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
            setRealPing(Date.now() - start);
        } catch (e) {
            setRealPing(-1);
        }
    };

    const handleCLI = async (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = cliInput.trim().toLowerCase();
        if (!cmd) return;
        debugService.log('INFO', 'CLI', 'EXEC', `> ${cmd}`);
        switch (cmd) {
            case 'clear': executeRepair('CLEAR_LOGS'); break;
            case 'refresh_keys': executeRepair('REFRESH_KEYS'); break;
            case 'diagnose': runHanisahDiagnosis(); break;
            case 'reload': window.location.reload(); break;
            default: debugService.log('WARN', 'CLI', 'UKN', `Command unknown: ${cmd}`);
        }
        setCliInput('');
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesFilter = logFilter === 'ALL' || log.level === logFilter;
            const matchesSearch = logSearch === '' || JSON.stringify(log).toLowerCase().includes(logSearch.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [logs, logFilter, logSearch]);

    const getLevelBadge = (level: string) => {
        const base = "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border";
        if(level === 'ERROR') return `${base} bg-red-500/10 border-red-500/30 text-red-500`;
        if(level === 'WARN') return `${base} bg-amber-500/10 border-amber-500/30 text-amber-500`;
        return `${base} bg-zinc-500/10 border-zinc-500/30 text-zinc-500`;
    };

    return (
        <div className="min-h-full flex flex-col px-4 pb-40 pt-[calc(env(safe-area-inset-top)+2rem)] md:px-12 md:pt-16 lg:px-16 animate-fade-in custom-scroll bg-noise">
            <div className="max-w-[1600px] mx-auto w-full space-y-12 md:space-y-16 h-full flex flex-col">
                
                {/* HEADER */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-black/5 dark:border-white/5 pb-10 shrink-0">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] ${features.AUTO_DIAGNOSTICS ? 'bg-[var(--accent-color)] animate-pulse' : 'bg-red-500'}`}></div>
                            <span className="tech-mono text-[9px] font-black uppercase tracking-[0.4em] text-neutral-500">
                                SYSTEM_INTEGRITY_MODULE_v101.0 {features.AUTO_DIAGNOSTICS ? '' : '[OFFLINE]'}
                            </span>
                        </div>
                        <h2 className="text-[12vw] md:text-[5rem] xl:text-[7rem] heading-heavy text-black dark:text-white leading-[0.85] tracking-tighter uppercase break-words">
                            SYSTEM <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-500 animate-gradient-text">MECHANIC</span>
                        </h2>
                    </div>
                    
                    <div className="flex bg-zinc-100 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5 overflow-x-auto max-w-full">
                        {['OVERVIEW', 'KERNEL_STREAM', 'UI_MATRIX', 'MEMORY'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-4 md:px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                    activeTab === tab 
                                    ? 'bg-white dark:bg-[#0a0a0b] text-[var(--accent-color)] shadow-sm' 
                                    : 'text-neutral-500 hover:text-black dark:hover:text-white'
                                }`}
                            >
                                {tab.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </header>

                {/* --- OVERVIEW TAB --- */}
                {activeTab === 'OVERVIEW' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 animate-slide-up">
                        <div className="lg:col-span-8 space-y-6">
                            
                            {/* Auto Diagnostics Off Warning */}
                            {!features.AUTO_DIAGNOSTICS && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-3">
                                    <Power size={18} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        AUTO_DIAGNOSTICS_DISABLED // TELEMETRY PAUSED
                                    </span>
                                </div>
                            )}

                            {/* Vitals */}
                            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 transition-opacity duration-500 ${features.AUTO_DIAGNOSTICS ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                                <VitalsCard label="LATENCY" value={`${health.avgLatency}ms`} icon={<Network size={18} />} status={health.avgLatency > 1000 ? 'danger' : 'good'} subtext="API_RESPONSE" />
                                <VitalsCard label="HEAP_MEM" value={`${health.memoryMb || 'N/A'}MB`} icon={<HardDrive size={18} />} status={health.memoryMb > 800 ? 'warning' : 'good'} subtext="ALLOCATED_RAM" />
                                <VitalsCard label="ERROR_LOG" value={`${health.errorCount}`} icon={<Bug size={18} />} status={health.errorCount > 5 ? 'danger' : 'good'} subtext="SESSION_ERRORS" />
                                <div onClick={runPingTest} className="cursor-pointer group p-6 rounded-[24px] border border-black/5 dark:border-white/5 bg-white dark:bg-[#0a0a0b] hover:border-accent/30 transition-all flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 rounded-xl bg-zinc-100 dark:bg-white/5 text-neutral-400 group-hover:text-accent transition-colors"><Wifi size={18}/></div>
                                        <div className={`w-2 h-2 rounded-full ${realPing === -1 ? 'bg-red-500' : 'bg-emerald-500'} ${!realPing && 'animate-pulse'}`}></div>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1">NET_PING</p>
                                        <p className="text-3xl font-black italic tracking-tighter dark:text-white">{realPing === null ? 'TEST' : realPing === -1 ? 'ERR' : `${realPing}ms`}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Hydra Status */}
                            <div className="bg-white dark:bg-[#0a0a0b] rounded-[32px] border border-black/5 dark:border-white/5 overflow-hidden">
                                <div className="p-6 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-zinc-50 dark:bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <Server size={18} className="text-[var(--accent-color)]" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">HYDRA_ENGINE_STATUS</span>
                                    </div>
                                    <button 
                                        onClick={handleHydraRefresh} 
                                        className={`p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-neutral-400 hover:text-[var(--accent-color)] transition-all ${isRotatingKeys ? 'animate-spin text-accent' : ''}`} 
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {providers.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${p.status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-wider dark:text-white">{p.id}</p>
                                                    <p className="text-[8px] tech-mono text-neutral-500">{p.status === 'COOLDOWN' ? `RESTORING (${p.cooldownRemaining}m)` : 'OPERATIONAL'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black italic text-[var(--accent-color)]">{p.keyCount}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <RepairButton icon={<Trash2 />} label="FLUSH MEMORY" onClick={() => executeRepair('OPTIMIZE_MEMORY')} />
                                <RepairButton icon={<RefreshCw />} label="ROTATE KEYS" onClick={() => executeRepair('REFRESH_KEYS')} />
                                <RepairButton icon={<ShieldCheck />} label="CLEAR LOGS" onClick={() => executeRepair('CLEAR_LOGS')} />
                                <RepairButton icon={<Power />} label="FORCE REBOOT" onClick={() => executeRepair('HARD_RESET')} danger />
                            </div>
                        </div>

                        {/* Diagnostics Panel */}
                        <div className="lg:col-span-4 flex flex-col h-full bg-white dark:bg-[#0a0a0b] rounded-[32px] border border-black/5 dark:border-white/5 overflow-hidden shadow-xl">
                            <div className="p-6 border-b border-black/5 dark:border-white/5 bg-[var(--accent-color)]/5 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Stethoscope size={20} className="text-[var(--accent-color)]" />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] dark:text-white">HANISAH_DIAGNOSTICS</h3>
                                </div>
                                {hanisahDiagnosis && <button onClick={() => speakWithHanisah(hanisahDiagnosis.replace(/[*#_`]/g, ''))} className="p-2 bg-white/10 rounded-full hover:text-[var(--accent-color)] transition-colors text-neutral-500"><Volume2 size={16} /></button>}
                            </div>
                            <div className="flex-1 p-6 relative overflow-y-auto custom-scroll">
                                {hanisahDiagnosis ? (
                                    <div className="prose dark:prose-invert prose-sm max-w-none animate-slide-up text-xs font-medium leading-relaxed"><Markdown>{hanisahDiagnosis}</Markdown></div>
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 text-center p-8 space-y-4">
                                        <Activity size={48} className="text-neutral-500" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">SYSTEM_IDLE</p>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-black/5 dark:border-white/5 bg-zinc-50 dark:bg-white/[0.02]">
                                <button onClick={runHanisahDiagnosis} disabled={isScanning} className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 transition-all ${isScanning ? 'bg-zinc-200 dark:bg-white/10 text-neutral-500' : 'bg-[var(--accent-color)] text-on-accent shadow-lg'}`}>
                                    {isScanning ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />} {isScanning ? 'RUNNING_ANALYSIS...' : 'START_DIAGNOSIS'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- KERNEL STREAM (TERMINAL) TAB --- */}
                {activeTab === 'KERNEL_STREAM' && (
                    <div className={`flex-1 bg-terminal-void rounded-[32px] border flex flex-col shadow-2xl relative overflow-hidden font-mono animate-slide-up terminal-scanlines transition-colors duration-500 ${isStreamFrozen ? 'border-amber-500/30' : 'border-white/10'}`}>
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r z-10 transition-colors duration-500 ${isStreamFrozen ? 'from-amber-500 to-red-500' : 'from-emerald-500 to-cyan-500'}`}></div>
                        
                        <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md relative z-20">
                            <div className="flex items-center gap-4">
                                <span className={`text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-2 ${isStreamFrozen ? 'text-amber-500' : 'text-neutral-400'}`}>
                                    <Terminal size={12} /> {isStreamFrozen ? 'STREAM_FROZEN' : 'KERNEL_STREAM'}
                                </span>
                                <div className="flex items-center gap-2">
                                    <input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="GREP..." className="bg-transparent border-none text-[10px] text-white focus:outline-none uppercase w-24 placeholder:text-neutral-700"/>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={toggleStreamFreeze} 
                                    className={`p-1.5 rounded-lg border transition-all ${isStreamFrozen ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'border-white/10 text-neutral-500 hover:text-white'}`}
                                    title={isStreamFrozen ? "Resume Stream" : "Pause Stream"}
                                >
                                    {isStreamFrozen ? <Play size={10} fill="currentColor"/> : <Pause size={10} />}
                                </button>
                                <button onClick={() => executeRepair('CLEAR_LOGS')} className="p-1.5 rounded border border-white/10 text-neutral-500 hover:text-red-500 transition-all"><Trash2 size={10}/></button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scroll text-[10px] relative z-10">
                            {filteredLogs.map(log => (
                                <div key={log.id} className="flex flex-col gap-1 p-1.5 hover:bg-white/5 rounded transition-colors group">
                                    <div className={`flex gap-3 ${log.level === 'ERROR' ? 'text-red-400' : log.level === 'WARN' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        <span className="opacity-50 shrink-0 font-mono">[{log.timestamp.split('T')[1].replace('Z','')}]</span>
                                        <div className={getLevelBadge(log.level)}>{log.level}</div>
                                        <span className="font-bold shrink-0 w-24 text-right opacity-70 uppercase">{log.layer}</span>
                                        <span className="break-all flex-1 text-neutral-300 font-mono">{log.message}</span>
                                    </div>
                                </div>
                            ))}
                            {isStreamFrozen && (
                                <div className="sticky bottom-0 left-0 right-0 p-2 text-center bg-amber-900/40 text-amber-500 text-[9px] font-black uppercase tracking-widest backdrop-blur-md">
                                    /// STREAM PAUSED - BUFFERING BACKGROUND LOGS ///
                                </div>
                            )}
                            <div ref={logEndRef} />
                        </div>
                        
                        <div className="p-3 bg-[#0a0a0b] border-t border-white/10 relative z-20">
                            <div className="relative flex items-end group">
                                <span className="absolute left-3 top-3.5 text-[var(--accent-color)] font-black text-xs animate-pulse">{'>'}</span>
                                <textarea ref={inputRef} value={cliInput} onChange={e => setCliInput(e.target.value)} onKeyDown={(e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleCLI(e as any); } }} placeholder="ENTER_COMMAND..." rows={1} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-8 pr-12 text-[11px] text-white focus:outline-none focus:border-[var(--accent-color)]/50 focus:bg-white/10 transition-all font-mono resize-none overflow-hidden min-h-[42px]"/>
                                <button onClick={(e) => handleCLI(e as any)} disabled={!cliInput} className="absolute right-2 bottom-2 p-1.5 bg-white/10 rounded-lg text-neutral-400 hover:text-white hover:bg-[var(--accent-color)]/20 transition-all disabled:opacity-0"><ArrowRight size={14} /></button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- UI MATRIX TAB --- */}
                {activeTab === 'UI_MATRIX' && (
                    <IntegrityMatrix />
                )}

                {/* --- MEMORY TAB (LOCAL STORAGE) --- */}
                {activeTab === 'MEMORY' && (
                    <div className="flex-1 bg-white dark:bg-[#0a0a0b] rounded-[32px] border border-black/5 dark:border-white/5 flex overflow-hidden shadow-lg animate-slide-up">
                        <div className="w-1/3 border-r border-black/5 dark:border-white/5 overflow-y-auto custom-scroll p-2 bg-zinc-50 dark:bg-black/20">
                            <div className="flex justify-between items-center p-3 mb-2">
                                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">STORAGE_KEYS</h3>
                                <button onClick={updateStorageList} className="text-neutral-400 hover:text-accent"><RefreshCw size={12} /></button>
                            </div>
                            {storageKeys.map(k => (
                                <button key={k} onClick={() => loadStorageValue(k)} className={`w-full text-left px-3 py-3 rounded-lg text-[9px] font-mono truncate transition-all mb-1 ${selectedStorageKey === k ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20' : 'text-neutral-500 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white'}`}>
                                    {k}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d0d0e]">
                            {selectedStorageKey ? (
                                <>
                                    <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-zinc-50 dark:bg-white/[0.01]">
                                        <div className="flex items-center gap-3">
                                            <Key size={14} className="text-accent" />
                                            <span className="text-[10px] font-bold text-black dark:text-white uppercase tracking-wider truncate mr-2">{selectedStorageKey}</span>
                                        </div>
                                        <button onClick={() => { localStorage.removeItem(selectedStorageKey); updateStorageList(); setSelectedStorageKey(null); }} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors border border-transparent hover:border-red-500/20" title="Delete Key"><Trash2 size={16} /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 custom-scroll">
                                        <JsonTree data={storageValue} />
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 opacity-50 gap-4">
                                    <Database size={48} strokeWidth={1} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">SELECT_DATA_NODE</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* CLI FOOTER */}
            <div className="p-3 bg-[#0a0a0b] border-t border-white/10 shrink-0 relative z-20">
                <form onSubmit={handleCLI} className="relative flex items-center group">
                    <span className="absolute left-3 text-[var(--accent-color)] font-black text-xs animate-pulse">{'>'}</span>
                    <input 
                        type="text" 
                        value={cliInput}
                        onChange={(e) => setCliInput(e.target.value)}
                        placeholder="ENTER_COMMAND..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-8 pr-12 text-[11px] text-white focus:outline-none focus:border-[var(--accent-color)]/50 focus:bg-white/10 transition-all font-mono placeholder:text-neutral-700"
                    />
                    <button type="submit" disabled={!cliInput} className="absolute right-2 p-1.5 bg-white/10 rounded-lg text-neutral-400 hover:text-white hover:bg-[var(--accent-color)]/20 transition-all disabled:opacity-0">
                        <ArrowRight size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
};

const VitalsCard: React.FC<{ label: string, value: string, icon: React.ReactNode, status: 'good'|'warning'|'danger', subtext: string }> = ({ label, value, icon, status, subtext }) => (
    <div className={`p-6 rounded-[24px] border flex flex-col justify-between h-full transition-all ${status === 'danger' ? 'bg-red-500/5 border-red-500/20' : status === 'warning' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white dark:bg-[#0a0a0b] border-black/5 dark:border-white/5'}`}>
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${status === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-zinc-100 dark:bg-white/5 text-neutral-400'}`}>{icon}</div>
            <div className={`w-2 h-2 rounded-full ${status === 'danger' ? 'bg-red-500 animate-ping' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
        </div>
        <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1">{label}</p>
            <p className="text-3xl font-black italic tracking-tighter dark:text-white">{value}</p>
            <p className="text-[7px] tech-mono font-bold text-neutral-400 mt-2">{subtext}</p>
        </div>
    </div>
);

const RepairButton: React.FC<{ icon: React.ReactNode, label: string, onClick: () => Promise<void>, danger?: boolean }> = ({ icon, label, onClick, danger }) => {
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS'>('IDLE');
    const handleClick = async () => {
        if (status !== 'IDLE') return;
        setStatus('LOADING');
        await onClick();
        setStatus('SUCCESS');
        setTimeout(() => setStatus('IDLE'), 2000);
    };
    return (
        <button 
            onClick={handleClick} 
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[24px] border transition-all hover:scale-[1.02] active:scale-95 relative overflow-hidden ${
                danger 
                ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 text-red-500' 
                : 'bg-white dark:bg-[#0a0a0b] border-black/5 dark:border-white/5 hover:border-[var(--accent-color)]/30 hover:text-[var(--accent-color)] text-neutral-500'
            }`}
        >
            <div className={`absolute inset-0 flex flex-col items-center justify-center bg-emerald-500 text-white transition-all duration-300 ${status === 'SUCCESS' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <CheckCircle2 size={24} className="animate-bounce" />
                <span className="text-[8px] font-black uppercase tracking-widest mt-2">DONE</span>
            </div>
            <div className={`transition-all duration-300 flex flex-col items-center gap-3 ${status === 'SUCCESS' ? 'opacity-0' : 'opacity-100'}`}>
                {status === 'LOADING' ? <RefreshCw size={20} className="animate-spin" /> : React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
                <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight">{label}</span>
            </div>
        </button>
    );
};
