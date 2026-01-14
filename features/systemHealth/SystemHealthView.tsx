import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  RefreshCw,
  ShieldCheck,
  Wifi,
  Stethoscope,
  CheckCircle2,
  Play,
  Pause,
  ArrowRight,
  Terminal,
  Layers,
  Network,
  HardDrive,
  Server
} from 'lucide-react';
import Markdown from 'react-markdown';
import { debugService } from '../../services/debugService';
import { KEY_MANAGER, type ProviderStatus } from '../../services/geminiService';
import { HANISAH_KERNEL } from '../../services/melsaKernel';
import { speakWithHanisah } from '../../services/elevenLabsService';
import { type LogEntry } from '../../types';
import { executeMechanicTool } from '../mechanic/mechanicTools';
import { IntegrityMatrix } from './components/IntegrityMatrix';
import { useFeatures } from '../../contexts/FeatureContext';
import useLocalStorage from '../../hooks/useLocalStorage';
import { Input } from '../../components/ui/Input';

const cardClass = 'bg-[var(--surface)] border border-[color:var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-soft)]';
const sectionTitle = 'text-lg font-bold text-[var(--text)]';
const labelText = 'caption text-text-muted';

const LiveSparkline: React.FC<{ data: number[]; color?: string }> = ({ data, color = 'var(--accent)' }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((val - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="w-full h-16" preserveAspectRatio="none" viewBox="0 0 100 100">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
};

const ProviderCard: React.FC<{ provider: ProviderStatus }> = ({ provider }) => {
  const healthy = provider.status === 'HEALTHY';
  const cooldown = provider.status === 'COOLDOWN';
  const tone = healthy ? 'text-[var(--success)]' : cooldown ? 'text-[var(--warning)]' : 'text-[var(--danger)]';

  return (
    <div className={`${cardClass} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server size={14} className={tone} />
          <span className="text-[12px] font-semibold text-[var(--text)]">{provider.id}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${healthy ? 'bg-[var(--success)]' : cooldown ? 'bg-[var(--warning)]' : 'bg-[var(--danger)]'}`} />
      </div>
      <p className="text-[12px] text-[var(--text-muted)] mt-2">Keys available: {provider.keyCount}</p>
      <p className={`text-[12px] font-semibold mt-1 ${tone}`}>
        {healthy ? 'Online' : cooldown ? `Cooling (${provider.cooldownRemaining}m)` : 'Unavailable'}
      </p>
    </div>
  );
};

const ActionButton: React.FC<{ label: string; desc: string; onClick: () => Promise<void>; tone?: 'accent' | 'neutral' }> = ({
  label,
  desc,
  onClick,
  tone = 'neutral'
}) => {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const colors = tone === 'accent' ? 'bg-[var(--accent)] text-[var(--on-accent-color)]' : 'bg-[var(--surface-2)] text-[var(--text)]';

  const handle = async () => {
    if (state !== 'idle') return;
    setState('loading');
    await onClick();
    setState('done');
    setTimeout(() => setState('idle'), 1500);
  };

  return (
    <button
      onClick={handle}
      className={`${cardClass} p-4 flex flex-col gap-1 items-start hover:scale-[1.01] transition-transform ${colors} ${tone === 'accent' ? '' : ''}`}
    >
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="text-[12px] text-[var(--text-muted)]">{state === 'done' ? 'Completed' : desc}</span>
      {state === 'loading' && <RefreshCw size={14} className="animate-spin text-[var(--accent)] mt-1" />}
      {state === 'done' && <CheckCircle2 size={14} className="text-[var(--success)] mt-1" />}
    </button>
  );
};

export const SystemHealthView: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [health, setHealth] = useState<any>({ avgLatency: 0, memoryMb: 0, errorCount: 0 });
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const { features } = useFeatures();
  const [latencyHistory, setLatencyHistory] = useState<number[]>(new Array(30).fill(0));
  const [memoryHistory, setMemoryHistory] = useState<number[]>(new Array(30).fill(0));
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LOGS' | 'INTEGRITY'>('OVERVIEW');
  const [isScanning, setIsScanning] = useState(false);
  const [hanisahDiagnosis, setHanisahDiagnosis] = useState<string | null>(null);
  const [realPing, setRealPing] = useState<number | null>(null);
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isStreamFrozen, setIsStreamFrozen] = useLocalStorage<boolean>('kernel_stream_paused', false);
  const [cliInput, setCliInput] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const calcStorage = () => {
    try {
      let total = 0;
      for (const x in localStorage) {
        if (!Object.prototype.hasOwnProperty.call(localStorage, x)) continue;
        total += (localStorage[x].length + x.length) * 2;
      }
      setHealth((prev: any) => ({ ...prev, storageBytes: total }));
    } catch {
      /* ignore */
    }
  };

  const executeRepair = async (action: string) => {
    if (action === 'HARD_RESET') {
      if (confirm('Refresh the app now?')) window.location.reload();
      return;
    }
    await executeMechanicTool({ args: { action } });
    if (action === 'REFRESH_KEYS') setProviders(KEY_MANAGER.getAllProviderStatuses());
    if (action === 'CLEAR_LOGS') {
      setLogs([]);
      debugService.clear();
    }
    if (action === 'OPTIMIZE_MEMORY') {
      calcStorage();
      setHealth(debugService.getSystemHealth());
    }
  };

  const handlePing = async () => {
    setRealPing(null);
    const start = Date.now();
    try {
      await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
      setRealPing(Date.now() - start);
    } catch {
      setRealPing(-1);
    }
  };

  const runDiagnostics = async () => {
    setIsScanning(true);
    setHanisahDiagnosis(null);
    try {
      const toolResultJson = await executeMechanicTool({ args: { action: 'GET_DIAGNOSTICS' } });
      const prompt = `Please review these system metrics and summarize health, anomalies, and next actions in clear language.\n\n${toolResultJson}`;
      const response = await HANISAH_KERNEL.execute(prompt, 'gemini-3-flash-preview', []);
      setHanisahDiagnosis(response.text || 'No response generated.');
    } catch (e: any) {
      setHanisahDiagnosis(`Diagnostics failed: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    setLogs(debugService.getLogs());
    calcStorage();
    const unsubscribe = debugService.subscribe((newLogs) => {
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
        setLatencyHistory((prev) => [...prev.slice(1), h.avgLatency]);
        setMemoryHistory((prev) => [...prev.slice(1), h.memoryMb || 0]);
      }, 2500);
    }
    return () => {
      unsubscribe();
      if (diagInterval) clearInterval(diagInterval);
    };
  }, [features.AUTO_DIAGNOSTICS, isStreamFrozen]);

  useEffect(() => {
    if (activeTab === 'LOGS' && isAutoScroll && !isStreamFrozen && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab, isAutoScroll, isStreamFrozen]);

  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      const matchesFilter = logFilter === 'ALL' || log.level === logFilter;
      const matchesSearch = logSearch === '' || JSON.stringify(log).toLowerCase().includes(logSearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [logs, logFilter, logSearch]);

  return (
    <div className="h-full flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:px-8 lg:px-12 bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-[1400px] mx-auto w-full h-full flex flex-col gap-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-[color:var(--border)] pb-4">
          <div className="space-y-2">
            <p className={labelText}>System Status</p>
            <h1 className="text-3xl font-bold text-[var(--text)]">Health & Diagnostics</h1>
            <p className="text-[13px] text-[var(--text-muted)]">Monitor providers, latency, and recent activity.</p>
          </div>
          <div className="flex bg-[var(--surface)] border border-[color:var(--border)] rounded-xl p-1">
            {[
              { key: 'OVERVIEW', icon: <Activity size={14} />, label: 'Overview' },
              { key: 'LOGS', icon: <Terminal size={14} />, label: 'Logs' },
              { key: 'INTEGRITY', icon: <Layers size={14} />, label: 'Integrity' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition-all ${
                  activeTab === tab.key ? 'bg-[var(--accent)] text-[var(--on-accent-color)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 min-h-0">
          {activeTab === 'OVERVIEW' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-y-auto pb-6 custom-scroll">
              <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`${cardClass} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Network size={14} className="text-[var(--text-muted)]" />
                        <span className={labelText}>Latency</span>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${health.avgLatency > 1000 ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'}`} />
                    </div>
                    <p className="text-2xl font-bold mt-2">{health.avgLatency} ms</p>
                    <LiveSparkline data={latencyHistory} />
                  </div>
                  <div className={`${cardClass} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive size={14} className="text-[var(--text-muted)]" />
                        <span className={labelText}>Memory</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold mt-2">{health.memoryMb ? `${health.memoryMb} MB` : 'N/A'}</p>
                    <LiveSparkline data={memoryHistory} color="var(--accent-2)" />
                  </div>
                  <div className={`${cardClass} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi size={14} className="text-[var(--text-muted)]" />
                        <span className={labelText}>Ping</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold mt-2">{realPing === null ? '--' : realPing === -1 ? 'Error' : `${realPing} ms`}</p>
                    <button
                      onClick={handlePing}
                      className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-[12px] text-[var(--text)] hover:border-[color:var(--accent)]"
                    >
                      Check connection
                    </button>
                  </div>
                </div>

                <div className={`${cardClass} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={labelText}>Providers</p>
                      <p className="text-sm text-[var(--text)] font-semibold">API Availability</p>
                    </div>
                    <button
                      onClick={() => executeRepair('REFRESH_KEYS')}
                      className="px-3 py-2 rounded-lg border border-[color:var(--border)] text-[12px] flex items-center gap-2 hover:border-[color:var(--accent)]"
                    >
                      <RefreshCw size={14} /> Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {providers.map((p) => (
                      <ProviderCard key={p.id} provider={p} />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ActionButton label="Optimize storage" desc="Clean cached data" onClick={() => executeRepair('OPTIMIZE_MEMORY')} />
                  <ActionButton label="Rotate keys" desc="Refresh API credentials" onClick={() => executeRepair('REFRESH_KEYS')} />
                  <ActionButton label="Reload app" desc="Refresh the session" tone="accent" onClick={() => executeRepair('HARD_RESET')} />
                </div>
              </div>

              <div className="lg:col-span-4 space-y-4">
                <div className={`${cardClass} p-4 flex flex-col h-full`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={labelText}>Diagnostics</p>
                      <p className="text-sm font-semibold text-[var(--text)]">AI Health Summary</p>
                    </div>
                    {hanisahDiagnosis && (
                      <button
                        onClick={() => speakWithHanisah(hanisahDiagnosis.replace(/[*#_`]/g, ''))}
                        className="p-2 rounded-lg border border-[color:var(--border)] text-[var(--text-muted)] hover:border-[color:var(--accent)]"
                        title="Play diagnosis"
                      >
                        <Stethoscope size={16} />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scroll text-[13px] leading-relaxed">
                    {hanisahDiagnosis ? (
                      <Markdown className="prose dark:prose-invert prose-sm max-w-none">{hanisahDiagnosis}</Markdown>
                    ) : (
                      <p className="text-[var(--text-muted)]">Run diagnostics to see a summary.</p>
                    )}
                  </div>
                  <div className="pt-3">
                    <button
                      onClick={runDiagnostics}
                      disabled={isScanning}
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-[13px] font-semibold ${
                        isScanning
                          ? 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                          : 'bg-[var(--accent)] text-[var(--on-accent-color)] hover:opacity-90'
                      }`}
                    >
                      {isScanning ? <RefreshCw size={14} className="animate-spin" /> : <Stethoscope size={14} />}
                      {isScanning ? 'Running...' : 'Run diagnostics'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'LOGS' && (
            <div className={`${cardClass} h-full flex flex-col`}>
              <div className="p-3 border-b border-[color:var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={labelText}>Activity log</span>
                  <div className="flex gap-2">
                    {['ALL', 'INFO', 'WARN', 'ERROR'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setLogFilter(level)}
                        className={`px-3 py-1 rounded-lg text-[12px] font-semibold ${
                          logFilter === level ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search logs"
                    className="w-40 text-sm"
                  />
                  <button
                    onClick={() => setIsStreamFrozen((p) => !p)}
                    className="px-2 py-1 rounded-lg border border-[color:var(--border)] text-[12px]"
                  >
                    {isStreamFrozen ? <Play size={12} /> : <Pause size={12} />}
                  </button>
                  <button onClick={() => executeRepair('CLEAR_LOGS')} className="px-2 py-1 rounded-lg border border-[color:var(--border)] text-[12px]">
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scroll text-[12px]">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="grid grid-cols-[140px_80px_1fr] gap-2 px-3 py-1 border-b border-[color:var(--border)]/50">
                    <span className="text-[var(--text-muted)]">{log.timestamp.replace('T', ' ').replace('Z', '')}</span>
                    <span
                      className={`text-center font-semibold ${
                        log.level === 'ERROR' ? 'text-[var(--danger)]' : log.level === 'WARN' ? 'text-[var(--warning)]' : 'text-[var(--success)]'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-[var(--text)]">{log.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>

              <div className="p-3 border-t border-[color:var(--border)]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cmd = cliInput.trim().toLowerCase();
                    if (!cmd) return;
                    switch (cmd) {
                      case 'clear':
                        executeRepair('CLEAR_LOGS');
                        break;
                      case 'refresh':
                        executeRepair('REFRESH_KEYS');
                        break;
                      case 'diagnose':
                        runDiagnostics();
                        break;
                      case 'reload':
                        executeRepair('HARD_RESET');
                        break;
                      default:
                        debugService.log('WARN', 'CLI', 'UNKNOWN', cmd);
                    }
                    setCliInput('');
                  }}
                  className="flex items-center gap-2"
                >
                  <span className="text-[var(--accent)] font-bold">{'>'}</span>
                  <Input
                    value={cliInput}
                    onChange={(e) => setCliInput(e.target.value)}
                    placeholder="Type a command (clear, refresh, diagnose, reload)"
                    className="flex-1 text-sm"
                  />
                  <button type="submit" className="px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--on-accent-color)] text-[12px] font-semibold hover:opacity-90">
                    <ArrowRight size={12} />
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'INTEGRITY' && (
            <div className="h-full overflow-y-auto custom-scroll pb-6">
              <div className={cardClass}>
                <IntegrityMatrix />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
