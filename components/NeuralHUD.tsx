
import React, { useEffect, useRef } from 'react';
import { useNeuralLink } from '../contexts/NeuralLinkContext';
import { Maximize2, Mic, MicOff, Radio, X, Loader2, BrainCircuit, Activity } from 'lucide-react';

export const NeuralHUD: React.FC = () => {
    const { isLiveMode, isMinimized, liveStatus, activeTask, setMinimized, terminateSession, analyser } = useNeuralLink();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isLiveMode || !isMinimized || !analyser || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const sliceWidth = canvas.width / 32;
            let x = 0;

            for (let i = 0; i < 32; i++) {
                const v = dataArray[i * 4] / 128.0;
                const y = (v * canvas.height) / 2;
                ctx.fillStyle = 'rgba(var(--accent-rgb), 0.8)';
                ctx.fillRect(x, canvas.height / 2 - y / 2, 2, y);
                x += sliceWidth;
            }
        };
        draw();
        return () => cancelAnimationFrame(animationId);
    }, [isLiveMode, isMinimized, analyser]);

    if (!isLiveMode || !isMinimized) return null;

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1500] animate-slide-down">
            <div className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl ring-1 ring-accent/20 max-w-[90vw]">
                {/* Visualizer Pill */}
                <div className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5 border border-white/5">
                    <canvas ref={canvasRef} width={40} height={16} className="opacity-80" />
                    <div className={`w-2 h-2 rounded-full ${liveStatus === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                </div>

                {/* Status / Task Info */}
                <div className="flex flex-col min-w-[120px] md:min-w-[180px] truncate">
                    <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Neural Link Active</span>
                    <div className="flex items-center gap-2 truncate">
                        {activeTask ? (
                            <div className="flex items-center gap-2">
                                <Loader2 size={10} className="animate-spin text-accent" />
                                <span className="text-[10px] font-bold text-accent uppercase tracking-tighter truncate animate-pulse">{activeTask}</span>
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold text-white uppercase tracking-tight truncate">Awaiting instruction...</span>
                        )}
                    </div>
                </div>

                <div className="h-6 w-[1px] bg-white/10" />

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setMinimized(false)}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                        title="Expand to Fullscreen"
                    >
                        <Maximize2 size={16} />
                    </button>
                    <button 
                        onClick={terminateSession}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                        title="End Call"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
