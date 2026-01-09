import React, { useState } from 'react';
import { Fingerprint, ImagePlus, Aperture, Activity } from 'lucide-react';
import { GenerativeStudio } from './components/GenerativeStudio';
import { NeuralVision } from './components/NeuralVision';

const AIToolsView: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'GENERATIVE' | 'ANALYTIC' | null>('GENERATIVE');

    const toggleSection = (section: 'GENERATIVE' | 'ANALYTIC') => setActiveSection(activeSection === section ? null : section);

    return (
        <div className="min-h-full flex flex-col px-4 pb-32 pt-[calc(env(safe-area-inset-top)+2rem)] md:px-8 md:pt-12 md:pb-40 lg:px-12 animate-fade-in bg-noise relative overflow-hidden">
            {/* Ambient Background Orbs */}
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-cyan-600/10 blur-[150px] rounded-full pointer-events-none animate-float"></div>

            <div className="max-w-[1400px] mx-auto w-full space-y-10 relative z-10">
                
                {/* Unified Header - Consistent with Dashboard */}
                <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10 animate-slide-up pb-6">
                    <div className="space-y-6 flex-1">
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md tech-mono text-[10px] font-black uppercase text-accent tracking-[0.3em] shadow-[0_0_20px_rgba(var(--accent-rgb),0.2)] flex items-center gap-2">
                                <Fingerprint size={12} /> TOOLS_v25.0
                            </div>
                            <div className="h-[1px] w-12 bg-gradient-to-r from-accent/50 to-transparent"></div>
                        </div>
                        <h2 className="text-[13vw] md:text-[7rem] xl:text-[8rem] font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/50 leading-[0.85] uppercase drop-shadow-2xl">
                             NEURAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-500 animate-gradient-text">TOOLS</span>
                        </h2>
                    </div>
                    
                    <div className="flex items-center gap-3 px-6 py-4 bg-black/40 border border-white/10 rounded-2xl tech-mono text-[9px] font-black uppercase tracking-widest text-neutral-400 shadow-xl backdrop-blur-xl group hover:border-accent/30 transition-all">
                         <Activity size={14} className="text-emerald-500 animate-pulse" /> 
                         <span className="group-hover:text-white transition-colors">MULTI_ENGINE_READY</span>
                    </div>
                </header>

                <div className="space-y-8">
                    <GenerativeStudio 
                        isOpen={activeSection === 'GENERATIVE'} 
                        onToggle={() => toggleSection('GENERATIVE')}
                        icon={<ImagePlus />}
                    />

                    <NeuralVision 
                        isOpen={activeSection === 'ANALYTIC'} 
                        onToggle={() => toggleSection('ANALYTIC')}
                        icon={<Aperture />}
                    />
                </div>
            </div>
        </div>
    );
};

export default AIToolsView;