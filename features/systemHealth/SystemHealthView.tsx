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
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

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
  const tone = healthy ? 'text-[color:var(--success)]' : cooldown ? 'text-[color:var(--warning)]' : 'text-[color:var(--danger)]';

  return (
    <Card padding="sm" className="border-border/70 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server size={14} className={tone} />
          <span className="body-sm font-semibold text-[color:var(--text)]">{provider.id}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${healthy ? 'bg-[color:var(--success)]' : cooldown ? 'bg-[color:var(--warning)]' : 'bg-[color:var(--danger)]'}`} />
      </div>
      <p className="caption text-[color:var(--text-muted)] mt-2">Keys available: {provider.keyCount}</p>
      <p className={`caption font-semibold mt-1 ${tone}`}>
        {healthy ? 'Online' : cooldown ? `Cooling (${provider.cooldownRemaining}m)` : 'Unavailable'}
      </p>
    </Card>
  );
};

const ActionButton: React.FC<{ label: string; desc: string; onClick: () => Promise<void>; tone?: 'accent' | 'neutral' }> = ({
  label,
  desc,
  onClick,
  tone = 'neutral'
}) => {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const colors = tone === 'accent' ? 'bg-[color:var(--accent)] text-[color:var(--text-invert)]' : 'bg-[color:var(--surface-2)] text-[color:var(--text)]';

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
      className={`rounded-[var(--radius-lg)] border border-border/70 shadow-[var(--shadow-soft)] p-4 flex flex-col gap-1 items-start hover:-translate-y-0.5 transition-all ${colors}`}
    >
      <span className="body-sm font-semibold">{label}</span>
      <span className="caption text-text-muted">{state === 'done' ? 'Completed' : desc}</span>
      {state === 'loading' && <RefreshCw size={14} className="animate-spin text-accent mt-1" />}
      {state === 'done' && <CheckCircle2 size={14} className="text-success mt-1" />}
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
    <div className="h-full flex flex-col px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:px-8 lg:px-12 bg-bg text-text">
      <div className="max-w-[1400px] mx-auto w-full h-full flex flex-col gap-6">
        <header className="flex flex-col gap-4">
          <Card tone="translucent" className="p-6 border-border/60 shadow-[0_30px_100px_-60px_rgba(var(--accent-rgb),0.8)]">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="space-y-2">
                <p className={labelText}>Live system stack</p>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text">Health & Diagnostics</h1>
                <p className="body-sm text-text-muted">Unified view for providers, latency, integrity, and recent events.</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="px-3 py-1 rounded-full bg-[color:var(--surface-2)] text-xs font-semibold text-text flex items-center gap-2">
                    <ShieldCheck size={14} /> {providers.length} providers
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[color:var(--surface-2)] text-xs font-semibold text-text flex items-center gap-2">
                    <Wifi size={14} /> {realPing !== null ? (realPing === -1 ? 'Error' : `${realPing} ms`) : 'Ping idle'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[color:var(--surface-2)] text-xs font-semibold text-text flex items-center gap-2">
                    <Activity size={14} /> {logs.length} log entries
                  </span>
                </div>
              </div>
              <div className="flex bg-[color:var(--surface)] border border-[color:var(--border)] rounded-[var(--radius-md)] p-1 shadow-[var(--shadow-soft)]">
                {[
                  { key: 'OVERVIEW', icon: <Activity size={14} />, label: 'Overview' },
                  { key: 'LOGS', icon: <Terminal size={14} />, label: 'Logs' },
                  { key: 'INTEGRITY', icon: <Layers size={14} />, label: 'Integrity' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`px-4 py-2 rounded-[var(--radius-sm)] caption font-semibold flex items-center gap-2 transition-all ${
                      activeTab === tab.key ? 'bg-[color:var(--accent)] text-[color:var(--text-invert)] shadow-[0_12px_30px_-14px_rgba(var(--accent-rgb),0.9)]' : 'text-text-muted'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </header>

        <div className="flex-1 min-h-0">
          {activeTab === 'OVERVIEW' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-y-auto pb-6 custom-scroll">
              <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card padding="sm" className="h-full border-border/70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Network size={14} className="text-text-muted" />
                        <span className={labelText}>Latency</span>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${health.avgLatency > 1000 ? 'bg-danger' : 'bg-success'}`} />
                    </div>
                    <p className="page-title text-text mt-2">{health.avgLatency} ms</p>
                    <LiveSparkline data={latencyHistory} />
                  </Card>
                  <Card padding="sm" className="h-full border-border/70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive size={14} className="text-text-muted" />
                        <span className={labelText}>Memory</span>
                      </div>
                    </div>
                    <p className="page-title text-text mt-2">{health.memoryMb ? `${health.memoryMb} MB` : 'N/A'}</p>
                    <LiveSparkline data={memoryHistory} color="var(--accent-2)" />
                  </Card>
                  <Card padding="sm" className="h-full border-border/70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi size={14} className="text-text-muted" />
                        <span className={labelText}>Ping</span>
                      </div>
                    </div>
                    <p className="page-title text-text mt-2">{realPing === null ? '--' : realPing === -1 ? 'Error' : `${realPing} ms`}</p>
                    <Button variant="secondary" size="sm" className="mt-3" onClick={handlePing}>
                      Check connection
                    </Button>
                  </Card>
                </div>

                <Card padding="sm" className="border-border/70">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={labelText}>Providers</p>
                      <p className="body-sm text-text font-semibold">API Availability</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => executeRepair('REFRESH_KEYS')} className="border border-border/60">
                      <RefreshCw size={14} /> Refresh
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {providers.map((p) => (
                      <ProviderCard key={p.id} provider={p} />
                    ))}
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ActionButton label="Optimize storage" desc="Clean cached data" onClick={() => executeRepair('OPTIMIZE_MEMORY')} />
                  <ActionButton label="Rotate keys" desc="Refresh API credentials" onClick={() => executeRepair('REFRESH_KEYS')} />
                  <ActionButton label="Reload app" desc="Refresh the session" tone="accent" onClick={() => executeRepair('HARD_RESET')} />
                </div>
              </div>

              <div className="lg:col-span-4 space-y-4">
                <Card padding="sm" className="flex flex-col h-full border-border/70">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={labelText}>Diagnostics</p>
                      <p className="body-sm font-semibold text-text">AI Health Summary</p>
                    </div>
                    {hanisahDiagnosis && (
                      <button
                        onClick={() => speakWithHanisah(hanisahDiagnosis.replace(/[*#_`]/g, ''))}
                        className="p-2 rounded-lg border border-border text-text-muted hover:border-accent"
                        title="Play diagnosis"
                      >
                        <Stethoscope size={16} />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scroll body-sm text-text leading-relaxed">
                    {hanisahDiagnosis ? (
                      <Markdown className="prose dark:prose-invert prose-sm max-w-none">{hanisahDiagnosis}</Markdown>
                    ) : (
                      <p className="caption text-text-muted">Run diagnostics to see a summary.</p>
                    )}
                  </div>
                  <div className="pt-3">
                    <Button onClick={runDiagnostics} disabled={isScanning} className="w-full" variant={isScanning ? 'subtle' : 'primary'}>
                      {isScanning ? <RefreshCw size={14} className="animate-spin" /> : <Stethoscope size={14} />}
                      {isScanning ? 'Running...' : 'Run diagnostics'}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'LOGS' && (
            <Card className="h-full flex flex-col border-border/70">
              <div className="p-4 border-b border-[color:var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={labelText}>Activity log</span>
                  <div className="flex gap-2">
                    {['ALL', 'INFO', 'WARN', 'ERROR'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setLogFilter(level)}
                        className={`px-3 py-1 rounded-lg caption font-semibold ${
                          logFilter === level ? 'bg-surface-2 text-text' : 'text-text-muted'
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
                  <Button variant="ghost" size="sm" onClick={() => setIsStreamFrozen((p) => !p)} className="border border-border/60">
                    {isStreamFrozen ? <Play size={12} /> : <Pause size={12} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => executeRepair('CLEAR_LOGS')} className="border border-border/60">
                    Clear
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scroll caption text-text">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="grid grid-cols-[140px_80px_1fr] gap-2 px-3 py-1 border-b border-[color:var(--border)]/50">
                    <span className="text-text-muted">{log.timestamp.replace('T', ' ').replace('Z', '')}</span>
                    <span
                      className={`text-center font-semibold ${
                        log.level === 'ERROR' ? 'text-danger' : log.level === 'WARN' ? 'text-warning' : 'text-success'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-text">{log.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>

              <div className="p-4 border-t border-[color:var(--border)]">
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
                  <span className="text-accent font-bold">{'>'}</span>
                  <Input
                    value={cliInput}
                    onChange={(e) => setCliInput(e.target.value)}
                    placeholder="Type a command (clear, refresh, diagnose, reload)"
                    className="flex-1 text-sm"
                  />
                  <Button type="submit" size="sm" className="min-h-[40px]">
                    <ArrowRight size={12} />
                  </Button>
                </form>
              </div>
            </Card>
          )}

          {activeTab === 'INTEGRITY' && (
            <div className="h-full overflow-y-auto custom-scroll pb-6">
              <Card className="border-border/70">
                <IntegrityMatrix />
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
