
import React, { useState, useEffect, useCallback } from 'react';
import { 
    X, ChevronLeft, ArrowRight, 
    Terminal, Brain, CircuitBoard, 
    DatabaseZap, Activity, Zap, ShieldCheck 
} from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface TutorialOverlayProps {
  onComplete: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const steps: TutorialStep[] = [
    {
      id: "INIT",
      title: "SYSTEM ONLINE",
      subtitle: "ISTOIC TITANIUM v20.0",
      description: "Welcome, Operator. You have accessed a high-performance cognitive terminal. This system fuses local-first security with multi-engine generative intelligence.",
      icon: <Terminal size={48} />,
      color: "text-white"
    },
    {
      id: "CORES",
      title: "DUAL NEURAL CORES",
      subtitle: "PERSONA SELECTION",
      description: "Choose your operating mode: 'HANISAH' for creative, high-energy synthesis, or 'STOIC' for pure, logic-driven problem solving. Switch instantly via the header.",
      icon: <Brain size={48} />,
      color: "text-orange-500"
    },
    {
      id: "HYDRA",
      title: "HYDRA ENGINE",
      subtitle: "MULTI-LINK PROTOCOL",
      description: "We don't rely on one brain. The system auto-races Gemini, Groq, and DeepSeek in parallel. The fastest engine wins, ensuring zero-latency responses.",
      icon: <CircuitBoard size={48} />,
      color: "text-cyan-500"
    },
    {
      id: "VAULT",
      title: "SECURE VAULT",
      subtitle: "ENCRYPTED MEMORY",
      description: "Your intellectual assets are stored locally using SHA-256 encryption. Use the Lock icon on the dashboard to seal or access your private archive.",
      icon: <DatabaseZap size={48} />,
      color: "text-purple-500"
    },
    {
      id: "MECHANIC",
      title: "SYSTEM MECHANIC",
      subtitle: "SELF-HEALING MATRIX",
      description: "Encountering lag? The 'MECHANIC' module monitors API health, rotates keys, and flushes memory buffers automatically to maintain 100% uptime.",
      icon: <Activity size={48} />,
      color: "text-emerald-500"
    },
    {
      id: "ARSENAL",
      title: "ELITE ARSENAL",
      subtitle: "MULTIMODAL TOOLS",
      description: "Generate 8K visuals with Imagen 3, analyze complex data with Vision, and speak in real-time via Neural Link. The suite is ready.",
      icon: <Zap size={48} />,
      color: "text-yellow-500"
    }
  ];

  const handleNext = useCallback(() => {
    if (step < steps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      finish();
    }
  }, [step, steps.length]);

  const handlePrev = useCallback(() => {
    if (step > 0) {
      setStep(prev => prev - 1);
    }
  }, [step]);

  const finish = () => {
    setIsVisible(false);
    setTimeout(onComplete, 500);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  const currentStep = steps[step];

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-500 ease-out ${isVisible ? 'opacity-100 backdrop-blur-xl bg-black/60' : 'opacity-0 pointer-events-none'}`}
    >
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vh] bg-gradient-to-tr from-transparent via-accent/5 to-transparent opacity-30`} />
        </div>

        <div className={`
            relative w-full max-w-5xl h-[600px] md:h-[500px] flex flex-col md:flex-row
            bg-[#050505] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden
            transform transition-all duration-500 ring-1 ring-white/5
            ${isVisible ? 'translate-y-0 scale-100' : 'translate-y-10 scale-95'}
        `}>
            
            {/* LEFT PANEL: VISUAL */}
            <div className="relative w-full md:w-5/12 h-48 md:h-full bg-zinc-900/50 flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay" />
                
                {/* Dynamic Glow based on step */}
                <div className={`absolute inset-0 opacity-20 transition-colors duration-700 ${currentStep.color.replace('text-', 'bg-')}`} style={{ filter: 'blur(80px)' }}></div>

                <div className={`
                    relative z-10 w-24 h-24 md:w-32 md:h-32 rounded-[32px] 
                    flex items-center justify-center 
                    bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl
                    transition-all duration-500 group
                `}>
                    <div className={`transition-all duration-500 ${currentStep.color} group-hover:scale-110 drop-shadow-[0_0_15px_currentColor]`}>
                        {currentStep.icon}
                    </div>
                </div>

                {/* Step Indicator (Mobile) */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 md:hidden">
                    {steps.map((_, i) => (
                        <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-white' : 'w-2 bg-white/20'}`} />
                    ))}
                </div>
            </div>

            {/* RIGHT PANEL: CONTENT */}
            <div className="flex-1 flex flex-col relative p-8 md:p-12">
                {/* Skip Button */}
                <button 
                    onClick={finish} 
                    className="absolute top-6 right-6 p-2 text-neutral-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg flex items-center gap-2 group"
                >
                    <span className="text-[10px] font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Skip_Intro</span>
                    <X size={20} />
                </button>

                <div className="flex-1 flex flex-col justify-center space-y-6">
                    {/* Content Transition Container */}
                    <div key={step} className="animate-slide-up space-y-4">
                        <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 w-fit">
                            <span className="text-[9px] font-mono text-neutral-400">MODULE_0{step + 1}</span>
                            <div className="h-3 w-[1px] bg-white/10"></div>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${currentStep.color}`}>{currentStep.id}</span>
                        </div>
                        
                        <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white uppercase leading-[0.9]">
                            {currentStep.title}
                        </h2>
                        
                        <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em] border-l-2 border-white/10 pl-3">
                            {currentStep.subtitle}
                        </p>

                        <p className="text-sm md:text-base text-neutral-400 font-medium leading-relaxed max-w-md">
                            {currentStep.description}
                        </p>
                    </div>
                </div>

                {/* Footer / Navigation */}
                <div className="mt-auto flex items-center justify-between pt-8 border-t border-white/5">
                    {/* Desktop Step Dots */}
                    <div className="hidden md:flex gap-1.5">
                        {steps.map((_, i) => (
                            <div 
                                key={i} 
                                className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? `w-8 ${currentStep.color.replace('text-', 'bg-')}` : 'w-2 bg-white/10'}`} 
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button 
                            onClick={handlePrev}
                            disabled={step === 0}
                            className={`
                                p-4 rounded-xl border border-white/10 text-white transition-all duration-300
                                ${step === 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-white/5 hover:border-white/20 active:scale-95'}
                            `}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        
                        <button 
                            onClick={handleNext} 
                            className="
                                flex-1 md:flex-none h-14 px-8 rounded-xl font-black uppercase text-[11px] tracking-[0.25em] 
                                flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]
                                bg-white text-black hover:scale-[1.02] active:scale-95 min-w-[180px]
                            "
                        >
                            {step === steps.length - 1 ? 'INITIALIZE' : 'NEXT'}
                            {step === steps.length - 1 ? <ShieldCheck size={16} /> : <ArrowRight size={16} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
