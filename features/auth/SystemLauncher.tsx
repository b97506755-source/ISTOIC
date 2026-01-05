
import React from 'react';
import { Brain, Radio, Shield, Lock, Activity } from 'lucide-react';

interface SystemLauncherProps {
    onSelectSystem: (system: 'ISTOIC' | 'ISTOK') => void;
    onLock: () => void;
}

export const SystemLauncher: React.FC<SystemLauncherProps> = ({ onSelectSystem, onLock }) => {
    return (
        <div className="fixed inset-0 bg-[#050505] flex items-center justify-center p-6 z-[9000] font-sans">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(50,50,50,0.1)_0%,transparent_70%)] pointer-events-none"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 animate-fade-in">
                
                {/* CHOICE 1: ISTOIC AI (MAIN) */}
                <button 
                    onClick={() => onSelectSystem('ISTOIC')}
                    className="group relative h-80 md:h-96 rounded-[32px] border border-white/10 bg-[#0a0a0b] overflow-hidden transition-all duration-500 hover:border-cyan-500/50 hover:shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col items-center justify-center gap-6"
                >
                    <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="w-24 h-24 rounded-3xl bg-cyan-900/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                        <Brain size={48} strokeWidth={1.5} />
                    </div>
                    
                    <div className="text-center space-y-2 relative z-10">
                        <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase group-hover:text-cyan-400 transition-colors">ISTOIC<span className="text-cyan-500">AI</span></h2>
                        <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.3em]">Cognitive Operating System</p>
                    </div>

                    <div className="absolute bottom-8 px-4 py-1 rounded-full border border-white/5 bg-black/40 text-[9px] font-black text-neutral-400 uppercase tracking-widest group-hover:border-cyan-500/30 group-hover:text-cyan-500 transition-all">
                        SYSTEM_ONLINE
                    </div>
                </button>

                {/* CHOICE 2: ISTOK (SECURE LINE) */}
                <button 
                    onClick={() => onSelectSystem('ISTOK')}
                    className="group relative h-80 md:h-96 rounded-[32px] border border-white/10 bg-[#050000] overflow-hidden transition-all duration-500 hover:border-red-600/50 hover:shadow-[0_0_50px_rgba(220,38,38,0.2)] flex flex-col items-center justify-center gap-6"
                >
                    {/* Scanlines for IStok */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_4px,6px_100%] opacity-20 pointer-events-none"></div>
                    <div className="absolute inset-0 bg-red-900/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    <div className="w-24 h-24 rounded-3xl bg-red-900/10 border border-red-600/30 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_30px_rgba(220,38,38,0.3)] relative z-10">
                        <Radio size={48} strokeWidth={1.5} />
                    </div>

                    <div className="text-center space-y-2 relative z-10">
                        <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase group-hover:text-red-500 transition-colors">IStok</h2>
                        <p className="text-[10px] font-mono text-red-900/80 group-hover:text-red-500/80 uppercase tracking-[0.3em] transition-colors">Encrypted P2P Uplink</p>
                    </div>

                    <div className="absolute bottom-8 px-4 py-1 rounded-full border border-red-900/30 bg-red-950/20 text-[9px] font-black text-red-700 uppercase tracking-widest group-hover:border-red-500/50 group-hover:text-red-500 transition-all flex items-center gap-2">
                        <Shield size={10} /> SECURE_CHANNEL
                    </div>
                </button>
            </div>

            {/* Footer / Lock */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                <button 
                    onClick={onLock}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-500 hover:text-white transition-all border border-white/5 active:scale-95"
                >
                    <Lock size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">LOCK_TERMINAL</span>
                </button>
            </div>
        </div>
    );
};
