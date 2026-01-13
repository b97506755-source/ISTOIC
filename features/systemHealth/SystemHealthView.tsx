
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Activity, Terminal, ShieldCheck, Trash2, Network, Server, Database,
    Wifi, Power, Bug, Monitor, Volume2, 
    ChevronRight, Play, Pause, ArrowRight, Key, RefreshCw, Stethoscope, Search, CheckCircle2, HardDrive, 
    Cpu, Zap, Layers, Globe
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

// --- SUB-COMPONENT: LIVE SPARKLINE ---
const LiveSparkline: React.FC<{ data: number[], color: string, height?: number }> = ({ data, color, height = 40 }) => {
    if (data.length < 2) return null;
    
    const max = Math.max(...data, 100);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative w-full overflow-hidden" style={{ height: `${height}px` }}>
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={`M0,100 L0,${100 - ((data[0] - min) / range) * 100} ${points.split(' ').map((p,i) => `L${p}`).join(' ')} L100,100 Z`} fill={`url(#grad-${color})`} stroke="none" />
                <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
};

// --- SUB-COMPONENT: PROVIDER NODE ---
const ProviderNode: React.FC<{ provider: ProviderStatus }> = ({ provider }) => {
    const isHealthy = provider.status === 'HEALTHY';
    const isCooldown = provider.status === 'COOLDOWN';
    
    return (
        <div className={`relative overflow-hidden p-3 rounded-xl border transition-all duration-500 group sheen ${isHealthy ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40' : isCooldown ? 'bg-amber-500/5 border-amber-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    {provider.id.includes('GEMINI') ? <Monitor size={14} className={isHealthy ? "text-emerald-400" : "text-neutral-500"}/> :
                     provider.id.includes('OPENAI') ? <Cpu size={14} className={isHealthy ? "text-emerald-400" : "text-neutral-500"}/> :
                     <Globe size={14} className={isHealthy ? "text-emerald-400" : "text-neutral-500"}/>}
                    <span className="text-[9px] font-black uppercase tracking-wider text-white">{provider.id}</span>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : isCooldown ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`}></div>
            </div>
            
            <div className="flex justify-between items-end">
                <div>
                     <p className="text-[8px] text-neutral-500 font-mono">KEYS: {provider.keyCount}</p>
                     <p className={`text-[8px] font-black ${isHealthy ? 'text-emerald-600' : isCooldown ? 'text-amber-600' : 'text-red-600'}`}>
                        {isHealthy ? 'OPTIMAL' : isCooldown ? `COOLING ${provider.cooldownRemaining}m` : 'OFFLINE'}
                     </p>
                </div>
                {/* Visual Bar */}
                <div className="flex gap-0.5 items-end h-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-1 rounded-sm ${i < (provider.keyCount % 6) + 1 ? (isHealthy ? 'bg-emerald-500/50' : 'bg-neutral-700') : 'bg-neutral-800'}`} style={{ height: `${20 + Math.random() * 80}%` }}></div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const SystemHealthView: React.FC = () => {
    // Core Data
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [health, setHealth] = useState<any>({ avgLatency: 0, memoryMb: 0, errorCount: 0 });
    const [providers, setProviders] = useState<ProviderStatus[]>([]);
    const { features } = useFeatures();
    
    // Trend History State
    const [latencyHistory, setLatencyHistory] = useState<number[]>(new Array(30).fill(0));
    const [memoryHistory, setMemoryHistory] = useState<number[]>(new Array(30).fill(0));
    
    // UI State
    const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'TERMINAL' | 'MATRIX'>('TELEMETRY');
    const [isScanning, setIsScanning] = useState(false);
    const [hanisahDiagnosis, setHanisahDiagnosis] = useState<string | null>(null);
    const [storageUsage, setStorageUsage] = useState({ used: 0, percent: 0 });
    const [realPing, setRealPing] = useState<number | null>(null);
    
    // Animations
    const [isRotatingKeys, setIsRotatingKeys] = useState(false);

    // Terminal State
    const [logFilter, setLogFilter] = useState<string>('ALL');
    const [logSearch, setLogSearch] = useState<string>('');
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [isStreamFrozen, setIsStreamFrozen] = useLocalStorage<boolean>('kernel_stream_paused', false);
    
    const toggleStreamFreeze = () => setIsStreamFrozen((prev) => !prev);

    const [cliInput, setCliInput] = useState('');
    const logEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

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
            
            const prompt = `[ROLE: HANISAH_SYSTEM_MECHANIC]\nAnalisa data telemetri (CPU, RAM, Latency).\nBerikan laporan performa sistem gaya Cyberpunk/Sci-Fi.\n\n[RAW_DATA]\n${toolResultJson}\n\nFORMAT:\n1. **SYSTEM INTEGRITY**: (SCORE %)\n2. **METRICS SUMMARY**: (CPU/Mem/Net Status)\n3. **ANOMALIES**: (List - be specific)\n4. **OPTIMIZATION**: (Actionable steps)`;
            
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
        setLogs(debugService.getLogs()); 
        calcStorage();
        
        const unsubscribeLogs = debugService.subscribe((newLogs) => {
            if (!isStreamFrozen) setLogs(newLogs);
        });
        
        let diagInterval: any = null;

        if (features.AUTO_DIAGNOSTICS) {
            setHealth(debugService.getSystemHealth());
            setProviders(KEY_MANAGER.getAllProviderStatuses());
            
            diagInterval = setInterval(() => {
                const h = debugService.getSystemHealth();
                setHealth(h);
                setProviders(KEY_MANAGER.getAllProviderStatuses());
                calcStorage();

                // Update Trends
                setLatencyHistory(prev => [...prev.slice(1), h.avgLatency]);
                setMemoryHistory(prev => [...prev.slice(1), h.memoryMb || 0]);

            }, 2000); // Higher frequency for smooth graphs
        }

        return () => { 
            unsubscribeLogs();
            if (diagInterval) clearInterval(diagInterval);
        };
    }, [features.AUTO_DIAGNOSTICS, isStreamFrozen]); 

    // Auto-scroll Logic
    useEffect(() => {
        if (activeTab === 'TERMINAL' && isAutoScroll && !isStreamFrozen && logEndRef.current) {
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
        <div className="h-full flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:px-8 lg:px-12 animate-fade-in bg-noise overflow-hidden relative">
            <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col gap-6 relative z-10">
                
                {/* HEADER */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-4 shrink-0 bg-[#050505]/50 backdrop-blur-xl sticky top-0 z-30 pt-2 rounded-xl px-4 mt-2">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Activity size={16} className={`text-accent ${features.AUTO_DIAGNOSTICS ? 'animate-pulse' : ''}`} />
                            <span className="tech-mono text-[9px] font-black uppercase tracking-[0.4em] text-neutral-500">
                                SYSTEM_MECHANIC_v105 {features.AUTO_DIAGNOSTICS ? '[LIVE]' : '[PAUSED]'}
                            </span>
                        </div>
                        <h2 className="text-[8vw] md:text-[3.5rem] lg:text-[4rem] font-black italic tracking-tighter text-white leading-[0.85] uppercase">
                            NEURAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-600 animate-gradient-text">DASHBOARD</span>
                        </h2>
                    </div>
                    
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 overflow-x-auto max-w-full no-scrollbar">
                        {['TELEMETRY', 'TERMINAL', 'MATRIX'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
                                    activeTab === tab 
                                    ? 'bg-accent text-black shadow-lg shadow-accent/20' 
                                    : 'text-neutral-500 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {tab === 'TELEMETRY' && <Activity size={12}/>}
                                {tab === 'TERMINAL' && <Terminal size={12}/>}
                                {tab === 'MATRIX' && <Layers size={12}/>}
                                {tab}
                            </button>
                        ))}
                    </div>
                </header>

                {/* CONTENT AREA */}
                <div className="flex-1 min-h-0 relative pb-safe">
                    
                    {/* --- TELEMETRY TAB --- */}
                    {activeTab === 'TELEMETRY' && (
                        <div className="h-full overflow-y-auto custom-scroll pb-24 md:pb-10 animate-slide-up pr-2">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                
                                {/* 1. Vitals Grid */}
                                <div className="lg:col-span-8 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <VitalsCard 
                                            label="LATENCY" 
                                            value={`${health.avgLatency}ms`} 
                                            trendData={latencyHistory} 
                                            icon={<Network size={16} />} 
                                            status={health.avgLatency > 1000 ? 'danger' : 'good'} 
                                            color="#10b981"
                                        />
                                        <VitalsCard 
                                            label="MEMORY_HEAP" 
                                            value={`${health.memoryMb || 'N/A'}MB`} 
                                            trendData={memoryHistory} 
                                            icon={<HardDrive size={16} />} 
                                            status={health.memoryMb > 800 ? 'warning' : 'good'} 
                                            color="#f59e0b"
                                        />
                                        <div onClick={runPingTest} className="cursor-pointer group p-5 rounded-[24px] border border-white/5 bg-[#0a0a0b] hover:border-accent/30 transition-all flex flex-col justify-between h-32 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <div className="flex justify-between items-start z-10">
                                                <div className="flex items-center gap-2 text-neutral-400 group-hover:text-blue-400">
                                                    <Wifi size={16}/> <span className="text-[9px] font-black uppercase tracking-widest">NET_PING</span>
                                                </div>
                                                <div className={`w-2 h-2 rounded-full ${realPing === -1 ? 'bg-red-500' : 'bg-blue-500'} ${!realPing && 'animate-ping'}`}></div>
                                            </div>
                                            <div className="z-10">
                                                <p className="text-4xl font-black italic tracking-tighter text-white">
                                                    {realPing === null ? '...' : realPing === -1 ? 'ERR' : `${realPing}ms`}
                                                </p>
                                                <p className="text-[8px] font-mono text-neutral-500 mt-1">CLICK_TO_TEST</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Network Topology */}
                                    <div className="bg-[#0a0a0b] rounded-[32px] border border-white/10 overflow-hidden shadow-2xl relative">
                                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                                        
                                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02] relative z-10">
                                            <div className="flex items-center gap-3">
                                                <Server size={18} className="text-accent" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">HYDRA_NETWORK_TOPOLOGY</span>
                                            </div>
                                            <button 
                                                onClick={handleHydraRefresh} 
                                                className={`p-2 bg-white/5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-accent transition-all ${isRotatingKeys ? 'animate-spin text-accent' : ''}`} 
                                                title="Rotate API Keys"
                                            >
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                        
                                        <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 relative z-10">
                                            {providers.map(p => (
                                                <ProviderNode key={p.id} provider={p} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* 3. Maintenance Deck */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <ProtocolButton icon={<Trash2 />} label="FLUSH MEMORY" desc="Clear Cache" onClick={() => executeRepair('OPTIMIZE_MEMORY')} color="text-blue-500" />
                                        <ProtocolButton icon={<RefreshCw />} label="ROTATE KEYS" desc="Hydra Switch" onClick={() => executeRepair('REFRESH_KEYS')} color="text-amber-500" />
                                        <ProtocolButton icon={<ShieldCheck />} label="CLEAR LOGS" desc="Purge Buffer" onClick={() => executeRepair('CLEAR_LOGS')} color="text-emerald-500" />
                                        <ProtocolButton icon={<Power />} label="FORCE REBOOT" desc="Hard Reset" onClick={() => executeRepair('HARD_RESET')} danger />
                                    </div>
                                </div>

                                {/* 4. Hanisah AI Diagnostic Panel */}
                                <div className="lg:col-span-4 flex flex-col h-full bg-[#0a0a0b] rounded-[32px] border border-white/10 overflow-hidden shadow-2xl relative ring-1 ring-white/5">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] rounded-full pointer-events-none"></div>
                                    
                                    <div className="p-6 border-b border-white/5 bg-accent/5 flex justify-between items-center relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-accent/10 rounded-lg text-accent border border-accent/20">
                                                <Stethoscope size={18} />
                                            </div>
                                            <div>
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">HANISAH_DIAGNOSTICS</h3>
                                                <p className="text-[8px] font-mono text-neutral-500">AI SYSTEM ANALYSIS</p>
                                            </div>
                                        </div>
                                        {hanisahDiagnosis && <button onClick={() => speakWithHanisah(hanisahDiagnosis.replace(/[*#_`]/g, ''))} className="p-2 bg-white/5 rounded-full hover:text-accent transition-colors text-neutral-500 border border-white/5"><Volume2 size={16} /></button>}
                                    </div>

                                    <div className="flex-1 p-6 relative overflow-y-auto custom-scroll z-10">
                                        {hanisahDiagnosis ? (
                                            <div className="prose dark:prose-invert prose-sm max-w-none animate-slide-up text-xs font-medium leading-relaxed font-mono">
                                                <Markdown>{hanisahDiagnosis}</Markdown>
                                            </div>
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 text-center p-8 space-y-4">
                                                <Activity size={48} className="text-neutral-500" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">SYSTEM_IDLE</p>
                                                <p className="text-[8px] font-mono text-neutral-600">Waiting for diagnostic request...</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 border-t border-white/5 bg-white/[0.02] relative z-10">
                                        <button 
                                            onClick={runHanisahDiagnosis} 
                                            disabled={isScanning} 
                                            className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 transition-all ${isScanning ? 'bg-white/5 text-neutral-500 cursor-not-allowed' : 'bg-accent text-black hover:bg-white shadow-lg shadow-accent/20'}`}
                                        >
                                            {isScanning ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />} 
                                            {isScanning ? 'RUNNING_ANALYSIS...' : 'START_DIAGNOSIS'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- TERMINAL TAB (UPDATED) --- */}
                    {activeTab === 'TERMINAL' && (
                        <div className={`h-full bg-[#050505] rounded-[24px] border flex flex-col shadow-2xl relative overflow-hidden font-mono animate-slide-up terminal-scanlines transition-colors duration-500 ${isStreamFrozen ? 'border-amber-500/30 ring-1 ring-amber-500/20' : 'border-white/10'}`}>
                            {/* Terminal Top Bar */}
                            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02] backdrop-blur-md relative z-20 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-1.5 px-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 ${isStreamFrozen ? 'text-amber-500' : 'text-neutral-400'}`}>
                                        <Terminal size={12} /> {isStreamFrozen ? 'STREAM_FROZEN' : 'KERNEL_STREAM'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        value={logSearch} 
                                        onChange={e => setLogSearch(e.target.value)} 
                                        placeholder="GREP..." 
                                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-[9px] text-white focus:outline-none focus:border-accent/50 uppercase w-32 placeholder:text-neutral-700"
                                    />
                                    <button 
                                        onClick={toggleStreamFreeze} 
                                        className={`p-1.5 rounded border transition-all ${isStreamFrozen ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'border-white/10 text-neutral-500 hover:text-white bg-white/5'}`}
                                    >
                                        {isStreamFrozen ? <Play size={10} fill="currentColor"/> : <Pause size={10} />}
                                    </button>
                                    <button onClick={() => executeRepair('CLEAR_LOGS')} className="p-1.5 rounded border border-white/10 bg-white/5 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={10}/></button>
                                </div>
                            </div>
                            
                            {/* Logs Display */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scroll text-[10px] relative z-10 bg-[#050505]">
                                {filteredLogs.map(log => (
                                    <div key={log.id} className="flex gap-2 hover:bg-white/[0.03] px-2 py-0.5 rounded transition-colors group">
                                        <span className="text-neutral-600 font-mono shrink-0 select-none">{log.timestamp.split('T')[1].replace('Z','')}</span>
                                        <span className={`font-bold shrink-0 w-16 text-center ${log.level === 'ERROR' ? 'text-red-500 bg-red-500/10' : log.level === 'WARN' ? 'text-amber-500 bg-amber-500/10' : 'text-emerald-500 bg-emerald-500/10'} rounded px-1`}>{log.level}</span>
                                        <span className="font-bold shrink-0 text-neutral-500 w-24 truncate text-right border-r border-white/10 pr-2 mr-1">{log.layer}</span>
                                        <span className={`break-all flex-1 font-mono ${log.level === 'ERROR' ? 'text-red-300' : 'text-neutral-300'}`}>{log.message}</span>
                                    </div>
                                ))}
                                {isStreamFrozen && (
                                    <div className="sticky bottom-0 left-0 right-0 p-2 text-center bg-amber-900/40 text-amber-500 text-[9px] font-black uppercase tracking-widest backdrop-blur-md border-t border-amber-500/50">
                                        /// STREAM PAUSED - BUFFERING BACKGROUND LOGS ///
                                    </div>
                                )}
                                <div ref={logEndRef} />
                            </div>
                            
                            {/* CLI Input */}
                            <div className="p-3 bg-[#0a0a0b] border-t border-white/10 relative z-20 shrink-0">
                                <div className="relative flex items-center group bg-black/50 border border-white/10 rounded-lg overflow-hidden focus-within:border-accent/50 transition-colors">
                                    <span className="pl-3 text-accent font-black text-xs animate-pulse">{'>'}</span>
                                    <input 
                                        ref={inputRef} 
                                        value={cliInput} 
                                        onChange={e => setCliInput(e.target.value)} 
                                        onKeyDown={(e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleCLI(e as any); } }} 
                                        placeholder="ENTER_COMMAND..." 
                                        className="w-full bg-transparent border-none py-2.5 pl-2 pr-12 text-[11px] text-white focus:outline-none font-mono placeholder:text-neutral-700 h-full"
                                        autoComplete="off"
                                    />
                                    <button onClick={(e) => handleCLI(e as any)} disabled={!cliInput} className="absolute right-2 p-1.5 bg-white/10 rounded text-neutral-400 hover:text-white hover:bg-accent/20 transition-all disabled:opacity-0"><ArrowRight size={12} /></button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- MATRIX TAB --- */}
                    {activeTab === 'MATRIX' && (
                         <div className="h-full overflow-y-auto custom-scroll pb-20 pr-2">
                            <IntegrityMatrix />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: VITALS CARD ---
const VitalsCard: React.FC<{ label: string, value: string, icon: React.ReactNode, status: 'good'|'warning'|'danger', subtext: string, trendData?: number[], color?: string }> = ({ label, value, icon, status, subtext, trendData, color = '#10b981' }) => (
    <div className={`relative overflow-hidden p-5 rounded-[24px] border transition-all h-32 flex flex-col justify-between ${status === 'danger' ? 'bg-red-500/5 border-red-500/20' : status === 'warning' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-[#0a0a0b] border-white/5 hover:border-accent/20'}`}>
        <div className="flex justify-between items-start z-10 relative">
            <div className="flex items-center gap-2 text-neutral-400">
                {React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}
                <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <div className={`w-1.5 h-1.5 rounded-full ${status === 'danger' ? 'bg-red-500 animate-ping' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
        </div>
        
        <div className="z-10 relative">
            <p className="text-2xl font-black italic tracking-tighter text-white">{value}</p>
            <p className="text-[7px] tech-mono font-bold text-neutral-500 mt-1">{subtext}</p>
        </div>

        {/* Live Sparkline Background */}
        {trendData && (
            <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 pointer-events-none">
                <LiveSparkline data={trendData} color={color} height={64} />
            </div>
        )}
    </div>
);

// --- SUB-COMPONENT: PROTOCOL BUTTON ---
const ProtocolButton: React.FC<{ icon: React.ReactNode, label: string, desc: string, onClick: () => Promise<void>, danger?: boolean, color?: string }> = ({ icon, label, desc, onClick, danger, color = "text-neutral-400" }) => {
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
            className={`flex flex-col items-center justify-center gap-2 p-5 rounded-[24px] border transition-all hover:scale-[1.02] active:scale-95 relative overflow-hidden group ${
                danger 
                ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 text-red-500' 
                : 'bg-[#0a0a0b] border-white/5 hover:border-white/20 text-neutral-400 hover:text-white'
            }`}
        >
            <div className={`absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
            
            <div className={`transition-all duration-300 flex flex-col items-center gap-2 ${status === 'SUCCESS' ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                {status === 'LOADING' ? <RefreshCw size={24} className="animate-spin text-accent" /> : React.cloneElement(icon as React.ReactElement<any>, { size: 24, className: danger ? 'text-red-500' : color })}
                <div className="text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest block leading-tight">{label}</span>
                    <span className="text-[8px] text-neutral-600 font-mono mt-1 block">{desc}</span>
                </div>
            </div>

            <div className={`absolute inset-0 flex flex-col items-center justify-center bg-emerald-500 text-white transition-all duration-300 ${status === 'SUCCESS' ? 'opacity-100 scale-100' : 'opacity-0 scale-150 pointer-events-none'}`}>
                <CheckCircle2 size={28} className="animate-bounce" />
                <span className="text-[9px] font-black uppercase tracking-widest mt-2">EXECUTED</span>
            </div>
        </button>
    );
};
