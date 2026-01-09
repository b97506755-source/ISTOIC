
import React from 'react';
import { 
    Sparkles, Zap, Cpu, Box, Globe, Wind, Brain, 
    Network, CircuitBoard, Clock, ShieldCheck 
} from 'lucide-react';

interface AIProviderInfoProps {
    metadata?: {
        provider?: string;
        model?: string;
        latency?: number;
        isRerouting?: boolean;
        systemStatus?: string;
        [key: string]: any;
    };
    isHydra?: boolean;
    className?: string;
}

export const AIProviderInfo: React.FC<AIProviderInfoProps> = ({ metadata, isHydra, className = "" }) => {
    if (!metadata || (!metadata.provider && !metadata.model)) return null;

    const provider = (metadata.provider || 'UNKNOWN').toUpperCase();
    const model = (metadata.model || 'Unknown Model').replace(/-/g, ' ').toUpperCase();
    const latency = metadata.latency;

    // --- ICON MAPPING ---
    const getProviderIcon = () => {
        if (provider.includes('GEMINI') || provider.includes('GOOGLE')) return <Sparkles size={10} className="text-blue-400" />;
        if (provider.includes('GROQ')) return <Zap size={10} className="text-orange-400" />;
        if (provider.includes('OPENAI')) return <Cpu size={10} className="text-green-400" />;
        if (provider.includes('DEEPSEEK')) return <Brain size={10} className="text-indigo-400" />;
        if (provider.includes('MISTRAL')) return <Wind size={10} className="text-yellow-400" />;
        if (provider.includes('OPENROUTER')) return <Globe size={10} className="text-purple-400" />;
        if (provider.includes('HYDRA')) return <CircuitBoard size={10} className="text-emerald-400" />;
        return <Box size={10} className="text-neutral-400" />;
    };

    // --- COLOR THEMES ---
    const getTheme = () => {
        if (provider.includes('GEMINI')) return 'bg-blue-500/5 border-blue-500/20 text-blue-300';
        if (provider.includes('GROQ')) return 'bg-orange-500/5 border-orange-500/20 text-orange-300';
        if (provider.includes('OPENAI')) return 'bg-green-500/5 border-green-500/20 text-green-300';
        if (provider.includes('DEEPSEEK')) return 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300';
        if (provider.includes('HYDRA') || isHydra) return 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300';
        return 'bg-white/5 border-white/10 text-neutral-400';
    };

    return (
        <div className={`flex items-center gap-2 mt-2 select-none opacity-80 hover:opacity-100 transition-opacity ${className}`}>
            
            {/* MAIN BADGE */}
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border backdrop-blur-md ${getTheme()}`}>
                {getProviderIcon()}
                
                <div className="flex flex-col leading-none gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider">
                        {isHydra ? 'HYDRA_NODE' : provider}
                    </span>
                    <span className="text-[7px] font-mono opacity-70 truncate max-w-[150px]">
                        {model}
                    </span>
                </div>
            </div>

            {/* LATENCY METRIC (If available) */}
            {latency && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-neutral-500">
                    <Clock size={8} />
                    <span className="text-[8px] font-mono">{latency}ms</span>
                </div>
            )}

            {/* HYDRA WINNER INDICATOR */}
            {isHydra && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 animate-pulse">
                    <Network size={8} />
                    <span className="text-[7px] font-black uppercase tracking-widest">WINNER</span>
                </div>
            )}

             {/* SECURE INDICATOR */}
             <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-neutral-600">
                <ShieldCheck size={8} />
                <span className="text-[7px] font-black uppercase tracking-wider">E2EE</span>
            </div>

        </div>
    );
};
