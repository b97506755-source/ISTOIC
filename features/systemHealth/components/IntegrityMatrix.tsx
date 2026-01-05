
import React, { useState, useEffect } from 'react';
import { 
    LayoutGrid, Info, ToggleLeft, ToggleRight, 
    Zap, Wifi, Activity, Eye, Layers, Shield 
} from 'lucide-react';
import { debugService, type UIStatus } from '../../../services/debugService';
import { useFeatures, type SystemFeature } from '../../../contexts/FeatureContext';

// --- UI ELEMENT NODE (Existing Logic) ---
const UIElementNode: React.FC<{ id: string, status: UIStatus, errors: number, usage: number, onToggle: () => void }> = ({ id, status, errors, usage, onToggle }) => {
    const getStatusColor = () => {
        if (status === 'DISABLED') return 'bg-red-500/10 border-red-500 text-red-500';
        if (status === 'UNSTABLE') return 'bg-yellow-500/10 border-yellow-500 text-yellow-500 animate-pulse';
        return 'bg-emerald-500/10 border-emerald-500 text-emerald-500';
    };

    const cleanName = id.replace(/UI_|BTN_/g, '').replace(/_/g, ' ');

    return (
        <div 
            onClick={onToggle}
            className={`
                relative p-3 rounded-xl border transition-all cursor-pointer group select-none
                ${getStatusColor()} hover:scale-[1.02] active:scale-95
            `}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="p-1.5 rounded-lg bg-black/20">
                    {status === 'DISABLED' ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                </div>
                <div className="text-[9px] font-mono opacity-70">
                    ERR:{errors} | USE:{usage}
                </div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider truncate" title={id}>
                {cleanName}
            </div>
            <div className="text-[8px] font-mono mt-1 opacity-60">
                {status}
            </div>
        </div>
    );
};

// --- FEATURE TOGGLE CARD (New "Heavy Features" Logic) ---
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
            w-full flex items-center justify-between p-4 rounded-xl border transition-all group text-left
            ${isEnabled 
                ? 'bg-blue-500/10 border-blue-500/30' 
                : 'bg-zinc-900 border-white/5 opacity-60 hover:opacity-100'}
        `}
    >
        <div className="flex items-center gap-4">
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
        <div className={`transition-colors ${isEnabled ? 'text-blue-400' : 'text-neutral-600'}`}>
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
            
            {/* SECTION 1: KERNEL PROTOCOLS (Heavy Features) */}
            <div className="mb-8">
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

            <div className="h-[1px] bg-white/5 my-6"></div>

            {/* SECTION 2: UI GOVERNANCE (Element Integrity) */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <LayoutGrid size={18} className="text-accent" />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">UI_GOVERNANCE</h3>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-neutral-500 font-mono">
                    <Info size={12} className="text-accent" />
                    <span>RED = User Disabled | YELLOW = Unstable</span>
                </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
