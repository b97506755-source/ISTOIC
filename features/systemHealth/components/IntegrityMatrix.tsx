
import React, { useState, useEffect } from 'react';
import { 
    LayoutGrid, Info, ToggleLeft, ToggleRight, 
    Zap, Wifi, Activity, Eye, Layers, Shield 
} from 'lucide-react';
import { debugService, type UIStatus } from '../../../services/debugService';
import { useFeatures, type SystemFeature } from '../../../contexts/FeatureContext';

// --- UI ELEMENT NODE ---
const UIElementNode: React.FC<{ id: string, status: UIStatus, errors: number, usage: number, onToggle: () => void }> = ({ id, status, errors, usage, onToggle }) => {
    const getStatusColor = () => {
        if (status === 'DISABLED') return 'bg-red-900/10 border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
        if (status === 'UNSTABLE') return 'bg-amber-900/10 border-amber-500/50 text-amber-500 animate-pulse';
        return 'bg-emerald-900/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]';
    };

    const cleanName = id.replace(/UI_|BTN_/g, '').replace(/_/g, ' ');

    return (
        <div 
            onClick={onToggle}
            className={`
                relative p-3 rounded-lg border transition-all cursor-pointer group select-none flex flex-col justify-between h-24
                ${getStatusColor()} active:scale-95 backdrop-blur-sm
            `}
        >
            <div className="absolute top-1 right-1 opacity-20">
                <LayoutGrid size={40} strokeWidth={0.5} />
            </div>

            <div className="flex justify-between items-start relative z-10">
                <div className="text-[8px] font-mono opacity-70">
                    ERR: <span className={errors > 0 ? "text-red-400 font-bold" : ""}>{errors}</span>
                </div>
                <div className="p-1 rounded bg-black/40 text-white/50">
                    {status === 'DISABLED' ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
                </div>
            </div>
            
            <div className="relative z-10">
                <div className="text-[9px] font-black uppercase tracking-wider truncate mb-1" title={id}>
                    {cleanName}
                </div>
                <div className="flex items-center gap-2">
                     <div className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                     <span className="text-[7px] font-mono opacity-80">{usage} INTERACTIONS</span>
                </div>
            </div>
        </div>
    );
};

// --- FEATURE TOGGLE CARD ---
const FeatureToggleCard: React.FC<{ 
    id: SystemFeature, 
    label: string, 
    desc: string, 
    icon: React.ReactNode, 
    isEnabled: boolean, 
    onToggle: () => void 
}> = ({ label, desc, icon, isEnabled, onToggle }) => (
    <button 
        onClick={onToggle}
        className={`
            w-full flex items-center justify-between p-4 rounded-xl border transition-all group text-left relative overflow-hidden
            ${isEnabled 
                ? 'bg-blue-600/10 border-blue-500/30' 
                : 'bg-zinc-900/50 border-white/5 opacity-60 hover:opacity-100'}
        `}
    >
        {isEnabled && <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none"></div>}

        <div className="flex items-center gap-4 relative z-10">
            <div className={`p-2.5 rounded-lg transition-colors ${isEnabled ? 'bg-blue-500 text-white shadow-[0_0_15px_var(--accent-glow)]' : 'bg-white/5 text-neutral-500'}`}>
                {icon}
            </div>
            <div>
                <h4 className={`text-[10px] font-black uppercase tracking-widest ${isEnabled ? 'text-white' : 'text-neutral-400'}`}>
                    {label}
                </h4>
                <p className="text-[9px] text-neutral-500 font-mono mt-0.5">{desc}</p>
            </div>
        </div>
        <div className={`transition-colors relative z-10 ${isEnabled ? 'text-blue-400' : 'text-neutral-600'}`}>
            {isEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
        </div>
    </button>
);

export const IntegrityMatrix: React.FC = () => {
    const [uiMatrix, setUiMatrix] = useState<Record<string, any>>(debugService.getUIMatrix());
    const { features, toggleFeature } = useFeatures();

    useEffect(() => {
        const unsubscribe = debugService.subscribeUI((state) => setUiMatrix(state));
        return () => unsubscribe();
    }, []);

    const toggleUIElement = (id: string) => {
        const current = uiMatrix[id];
        const newStatus = current.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
        debugService.setUIStatus(id, newStatus);
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-20 bg-[#0a0a0b] rounded-[32px] border border-white/5 shadow-2xl animate-slide-up">
            
            {/* Background Circuit Pattern */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-full h-full bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

            {/* SECTION 1: KERNEL PROTOCOLS */}
            <div className="mb-8 relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Shield size={18} className="text-blue-500" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">KERNEL_PROTOCOLS</h3>
                    </div>
                    <span className="text-[9px] font-bold bg-blue-500/10 text-blue-500 px-2 py-1 rounded border border-blue-500/20">RESOURCE CONTROL</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FeatureToggleCard 
                        id="OMNI_RACE"
                        label="HYDRA OMNI-RACE"
                        desc="Parallel API execution (4x Bandwidth)."
                        icon={<Zap size={16} />}
                        isEnabled={features.OMNI_RACE}
                        onToggle={() => toggleFeature('OMNI_RACE')}
                    />
                    <FeatureToggleCard 
                        id="LIVE_LINK"
                        label="NEURAL LINK (AUDIO)"
                        desc="WebRTC Audio Streaming (High Battery)."
                        icon={<Wifi size={16} />}
                        isEnabled={features.LIVE_LINK}
                        onToggle={() => toggleFeature('LIVE_LINK')}
                    />
                    <FeatureToggleCard 
                        id="VISUAL_ENGINE"
                        label="CANVAS VISUALIZER"
                        desc="Real-time Audio Graph (High GPU)."
                        icon={<Eye size={16} />}
                        isEnabled={features.VISUAL_ENGINE}
                        onToggle={() => toggleFeature('VISUAL_ENGINE')}
                    />
                    <FeatureToggleCard 
                        id="HIGH_PERF_UI"
                        label="GLASSMORPHIC ENGINE"
                        desc="Blur effects & smooth animations (High GPU)."
                        icon={<Layers size={16} />}
                        isEnabled={features.HIGH_PERF_UI}
                        onToggle={() => toggleFeature('HIGH_PERF_UI')}
                    />
                    <FeatureToggleCard 
                        id="AUTO_DIAGNOSTICS"
                        label="AUTO_MECHANIC"
                        desc="Background system polling (High CPU)."
                        icon={<Activity size={16} />}
                        isEnabled={features.AUTO_DIAGNOSTICS}
                        onToggle={() => toggleFeature('AUTO_DIAGNOSTICS')}
                    />
                </div>
            </div>

            <div className="h-[1px] bg-white/5 my-6 relative z-10"></div>

            {/* SECTION 2: UI GOVERNANCE */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <LayoutGrid size={18} className="text-emerald-500" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">UI_GOVERNANCE_MATRIX</h3>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-neutral-500 font-mono">
                    <Info size={12} className="text-emerald-500" />
                    <span>TAP TO TOGGLE NODES</span>
                </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 relative z-10">
                {Object.values(uiMatrix).map((el: any) => (
                    <UIElementNode 
                        key={el.id}
                        id={el.id}
                        status={el.status}
                        errors={el.errorCount}
                        usage={el.usageCount}
                        onToggle={() => toggleUIElement(el.id)}
                    />
                ))}
            </div>
        </div>
    );
};
