
import React from 'react';
import { Radio, Cpu, Shield, Zap } from 'lucide-react';

interface AppSelectorProps {
    onSelect: (mode: 'ISTOIC' | 'ISTOK') => void;
}

export const AppSelector: React.FC<AppSelectorProps> = ({ onSelect }) => {
    return (
        <div className="fixed inset-0 bg-[#050505] flex items-center justify-center p-6 animate-fade-in z-[9999]">
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* OPTION 1: ISTOIC AI */}
                <button 
                    onClick={() => onSelect('ISTOIC')}
                    className="group relative h-80 bg-zinc-900/50 border border-white/10 rounded-[32px] p-8 flex flex-col justify-between hover:bg-white/5 hover:border-accent/50 transition-all duration-500 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="relative z-10 flex justify-between items-start">
                        <div className="p-4 rounded-2xl bg-white/5 text-accent border border-white/10 group-hover:scale-110 transition-transform">
                            <Cpu size={32} />
                        </div>
                        <div className="px-3 py-1 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors">
                            COGNITIVE_OS
                        </div>
                    </div>

                    <div className="relative z-10 text-left">
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2 group-hover:translate-x-2 transition-transform">
                            IStoic<span className="text-accent">AI</span>
                        </h2>
                        <p className="text-xs text-neutral-400 font-mono leading-relaxed max-w-xs">
                            Standard operating mode. Generative agents, smart vault, and neural tools active.
                        </p>
                    </div>
                </button>

                {/* OPTION 2: ISTOK P2P */}
                <button 
                    onClick={() => onSelect('ISTOK')}
                    className="group relative h-80 bg-red-950/10 border border-red-900/30 rounded-[32px] p-8 flex flex-col justify-between hover:bg-red-900/20 hover:border-red-500/50 transition-all duration-500 overflow-hidden ring-1 ring-transparent hover:ring-red-500/20"
                >
                    {/* Scanline Effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[size:100%_4px] opacity-20 pointer-events-none"></div>
                    
                    <div className="relative z-10 flex justify-between items-start">
                        <div className="p-4 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                            <Radio size={32} />
                        </div>
                        <div className="px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-[9px] font-black uppercase tracking-widest text-red-400 animate-pulse">
                            SECURE_UPLINK
                        </div>
                    </div>

                    <div className="relative z-10 text-left">
                        <h2 className="text-3xl font-black text-red-500 italic tracking-tighter uppercase mb-2 group-hover:translate-x-2 transition-transform">
                            IStok <span className="text-white opacity-50">P2P</span>
                        </h2>
                        <p className="text-xs text-red-300/70 font-mono leading-relaxed max-w-xs">
                            Direct P2P Channel. End-to-End Encrypted Payload. Public Signaling. No AI surveillance.
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-red-500 uppercase tracking-widest">
                            <Shield size={10} /> MILITARY_GRADE_AES256
                        </div>
                    </div>
                </button>

            </div>
            
            <div className="absolute bottom-8 text-center">
                <p className="text-[9px] text-neutral-600 font-mono uppercase tracking-[0.3em]">
                    SECURE_BOOT_LOADER // v101.0
                </p>
            </div>
        </div>
    );
};
