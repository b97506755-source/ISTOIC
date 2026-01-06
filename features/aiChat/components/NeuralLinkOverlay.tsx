
import React, { useEffect, useRef, useState } from 'react';
import { Flame, Brain, MicOff, Radio, X, Mic, Activity, Minus, Sparkles, Shield, CloudRain, Music, Volume2, Waves } from 'lucide-react';
import { type NeuralLinkStatus } from '../../../services/neuralLink';
import { useFeatures } from '../../../contexts/FeatureContext';
import { useLiveSession } from '../../../contexts/LiveSessionContext';

interface NeuralLinkOverlayProps {
  isOpen: boolean;
  status: NeuralLinkStatus;
  personaMode: 'hanisah' | 'stoic';
  transcriptHistory: Array<{role: 'user' | 'model', text: string}>;
  interimTranscript: {role: 'user' | 'model', text: string} | null;
  onTerminate: () => void;
  onMinimize: () => void;
  analyser?: AnalyserNode | null;
  activeTool?: string | null;
}

export const NeuralLinkOverlay: React.FC<NeuralLinkOverlayProps> = ({
  isOpen,
  status,
  personaMode,
  transcriptHistory,
  interimTranscript,
  onTerminate,
  onMinimize,
  analyser,
  activeTool
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Global Context for Audio Modes
  const { micMode, setMicMode, ambientMode, setAmbientMode } = useLiveSession();

  // Check Feature Flag
  const { isFeatureEnabled } = useFeatures();
  const isVisualEngineEnabled = isFeatureEnabled('VISUAL_ENGINE');

  // Prevent Body Scroll when open
  useEffect(() => {
      if (isOpen) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Auto-scroll transcript
  useEffect(() => {
      if (scrollRef.current) {
          const el = scrollRef.current;
          const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300;
          if (isNearBottom) {
              el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          }
      }
  }, [transcriptHistory, interimTranscript]);

  // Enhanced Audio Visualizer
  useEffect(() => {
    if (!isOpen || !analyser || !canvasRef.current) return;
    
    if (!isVisualEngineEnabled) {
        setVolume(128); // Static volume for orb
        return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const avg = sum / bufferLength;
      setVolume(avg); 
      setIsSpeaking(avg > 10); // Simple activity gate

      // Clear with trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height); 
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) * 0.45;
      
      const hue = personaMode === 'hanisah' ? 25 : 190; 
      
      const bars = 64; 
      const step = Math.floor(bufferLength / bars);
      
      ctx.beginPath();
      for (let i = 0; i < bars; i++) {
          const value = dataArray[i * step];
          const percent = value / 256;
          const height = maxRadius * 0.6 * percent;
          const angle = (i / bars) * Math.PI * 2;
          
          const x = centerX + Math.cos(angle) * (maxRadius * 0.8 + height);
          const y = centerY + Math.sin(angle) * (maxRadius * 0.8 + height);
          
          const xBase = centerX + Math.cos(angle) * (maxRadius * 0.8);
          const yBase = centerY + Math.sin(angle) * (maxRadius * 0.8);

          ctx.strokeStyle = `hsla(${hue}, 100%, ${60 + percent * 40}%, ${Math.max(0.3, percent)})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(xBase, yBase);
          ctx.lineTo(x, y);
          ctx.stroke();
      }
    };

    draw();
    return () => {
        cancelAnimationFrame(animationId);
        window.removeEventListener('resize', resizeCanvas);
    };
  }, [isOpen, analyser, personaMode, isVisualEngineEnabled]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] bg-black flex flex-col animate-fade-in font-sans touch-none">
      
      {/* 1. VISUALIZER LAYER */}
      {isVisualEngineEnabled && (
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 pointer-events-none z-0"
          />
      )}

      {/* 2. AMBIENT ORB LAYER */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 transition-transform duration-100 ease-out"
           style={{ transform: `scale(${1 + (volume / 256) * 0.15})` }}
      >
          <div className={`relative w-[280px] h-[280px] rounded-full blur-[80px] opacity-40 animate-pulse ${personaMode === 'hanisah' ? 'bg-orange-500' : 'bg-cyan-500'}`}></div>
          <div className="absolute inset-0 flex items-center justify-center">
               <div className={`w-32 h-32 rounded-full border-2 border-white/20 flex items-center justify-center backdrop-blur-md shadow-[0_0_50px_rgba(255,255,255,0.1)] ${status === 'ACTIVE' ? 'animate-[spin_10s_linear_infinite]' : ''}`}>
                    {personaMode === 'hanisah' ? <Flame size={48} className="text-white opacity-80" /> : <Brain size={48} className="text-white opacity-80" />}
               </div>
          </div>
      </div>

      {/* 3. UI LAYER */}
      <div className="relative z-20 flex flex-col h-full justify-between pointer-events-none">
          
          {/* HEADER */}
          <div className="p-6 pt-safe flex justify-between items-center pointer-events-auto">
              <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-full border bg-black/40 backdrop-blur-md flex items-center gap-2 ${status === 'ERROR' ? 'border-red-500 text-red-500' : 'border-white/10 text-white'}`}>
                      <Radio size={16} className={status === 'ACTIVE' ? 'animate-pulse text-green-400' : ''} />
                      <span className="text-xs font-black uppercase tracking-widest">{status}</span>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <button 
                    onClick={onMinimize} 
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/5 active:scale-90"
                    title="Minimize"
                  >
                      <Minus size={20} />
                  </button>
                  <button 
                    onClick={onTerminate} 
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-red-500/20 text-white hover:text-red-500 flex items-center justify-center transition-all border border-white/5 active:scale-90"
                    title="End Call"
                  >
                      <X size={20} />
                  </button>
              </div>
          </div>

          {/* DYNAMIC TRANSCRIPT AREA */}
          <div ref={scrollRef} className="flex-1 w-full max-w-2xl mx-auto px-6 overflow-y-auto no-scrollbar pointer-events-auto flex flex-col justify-end pb-8 space-y-4 mask-fade-top touch-pan-y">
              
              {transcriptHistory.map((item, idx) => (
                  <div key={idx} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                      <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-sm md:text-base font-medium leading-relaxed backdrop-blur-sm shadow-sm ${
                          item.role === 'user' 
                          ? 'bg-white/10 text-white/90 rounded-tr-none' 
                          : 'bg-black/60 text-accent/90 border border-accent/20 rounded-tl-none'
                      }`}>
                          {item.text}
                      </div>
                  </div>
              ))}

              {interimTranscript && (
                  <div className={`flex ${interimTranscript.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                      <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-base md:text-lg font-bold leading-relaxed backdrop-blur-md border shadow-lg ${
                          interimTranscript.role === 'user' 
                          ? 'bg-white/20 text-white border-white/20 rounded-tr-none' 
                          : 'bg-accent/20 text-accent border-accent/40 rounded-tl-none'
                      }`}>
                          {interimTranscript.text}
                          <span className="inline-block w-2 h-4 ml-1 align-middle bg-current animate-pulse"></span>
                      </div>
                  </div>
              )}
              
              {activeTool && (
                  <div className="flex justify-center animate-fade-in">
                      <div className="px-6 py-2 bg-blue-600/90 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 flex items-center gap-2 animate-pulse border border-white/20">
                          <Sparkles size={14} /> EXECUTING: {activeTool.replace(/_/g, ' ')}...
                      </div>
                  </div>
              )}
              
              {!interimTranscript && !activeTool && status === 'ACTIVE' && (
                  <div className="text-center text-white/40 text-xs font-mono uppercase tracking-widest animate-pulse mt-4">
                      {isSpeaking ? 'NEURAL ENGINE RESPONDING...' : (micMode === 'ISOLATION' ? 'VOICE ISOLATION ACTIVE' : 'LISTENING...')}
                  </div>
              )}
          </div>

          {/* AUDIO CONTROL DECK */}
          <div className="px-6 pb-4 pointer-events-auto flex justify-center">
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-2 flex items-center gap-1">
                  {/* Mic Modes */}
                  <button 
                      onClick={() => setMicMode(micMode === 'ISOLATION' ? 'STANDARD' : 'ISOLATION')}
                      className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 w-20 ${micMode === 'ISOLATION' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'hover:bg-white/5 text-neutral-400'}`}
                  >
                      <Shield size={18} />
                      <span className="text-[8px] font-black uppercase">ISOLATE</span>
                  </button>

                  <div className="w-[1px] h-8 bg-white/10 mx-1"></div>

                  {/* Ambient Modes */}
                  <button onClick={() => setAmbientMode('OFF')} className={`p-2 rounded-lg ${ambientMode === 'OFF' ? 'bg-white/20 text-white' : 'text-neutral-500 hover:text-white'}`}><Volume2 size={16}/></button>
                  <button onClick={() => setAmbientMode('CYBER')} className={`p-2 rounded-lg ${ambientMode === 'CYBER' ? 'bg-purple-500/20 text-purple-400' : 'text-neutral-500 hover:text-purple-400'}`}><Waves size={16}/></button>
                  <button onClick={() => setAmbientMode('RAIN')} className={`p-2 rounded-lg ${ambientMode === 'RAIN' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-500 hover:text-blue-400'}`}><CloudRain size={16}/></button>
              </div>
          </div>

          {/* CONTROLS FOOTER */}
          <div className="p-8 pb-safe flex justify-center items-center gap-6 pointer-events-auto bg-gradient-to-t from-black via-black/80 to-transparent">
              <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-16 h-16 rounded-full flex items-center justify-center border transition-all active:scale-95 ${
                      isMuted ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                  }`}
                  aria-label="Toggle Mute"
              >
                  {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
              </button>

              <button 
                  onClick={onTerminate}
                  className="h-16 px-10 rounded-full bg-red-600 hover:bg-red-500 text-white font-black text-xs tracking-[0.3em] uppercase shadow-lg shadow-red-900/50 hover:shadow-red-500/50 hover:scale-105 transition-all flex items-center gap-3 active:scale-95"
              >
                  <Activity size={20} className="animate-pulse" /> TERMINATE
              </button>
          </div>
      </div>

      <style>{`
        .mask-fade-top {
            mask-image: linear-gradient(to bottom, transparent 0%, black 15%);
            -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%);
        }
      `}</style>
    </div>
  );
};
