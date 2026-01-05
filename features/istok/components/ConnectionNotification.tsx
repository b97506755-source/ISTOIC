
import React, { useEffect, useState } from 'react';
import { ShieldCheck, X, Check, Loader2, Clock } from 'lucide-react';

interface ConnectionNotificationProps {
    identity: string;
    peerId: string;
    onAccept: () => void;
    onDecline: () => void;
    isProcessing?: boolean; // New prop for loading state
}

export const ConnectionNotification: React.FC<ConnectionNotificationProps> = ({ 
    identity, 
    peerId, 
    onAccept, 
    onDecline,
    isProcessing = false 
}) => {
    const [progress, setProgress] = useState(100);
    const TIMEOUT_DURATION = 60000; // 60 seconds auto-reject

    useEffect(() => {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
        
        // Auto-dismiss timer logic
        const startTime = Date.now();
        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / TIMEOUT_DURATION) * 100);
            setProgress(remaining);

            if (remaining === 0) {
                clearInterval(timer);
                onDecline(); // Auto decline on timeout
            }
        }, 100);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="fixed inset-x-0 top-0 z-[99999] p-4 pt-[calc(env(safe-area-inset-top)+1rem)] animate-slide-down pointer-events-none flex justify-center">
            {/* Backdrop Blur for the notch area specifically */}
            <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-black/90 to-transparent pointer-events-none -z-10 h-48"></div>

            <div className="w-full max-w-sm bg-[#121214] border border-emerald-500/30 rounded-[24px] overflow-hidden shadow-[0_10px_40px_-10px_rgba(16,185,129,0.3)] pointer-events-auto ring-1 ring-emerald-500/20 relative">
                
                {/* Progress Bar (Time Remaining) */}
                <div className="absolute top-0 left-0 h-1 bg-emerald-900 w-full">
                    <div className="h-full bg-emerald-500 transition-all ease-linear" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="p-5">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shrink-0 shadow-lg shadow-emerald-500/10 animate-pulse">
                            <ShieldCheck size={24} className="text-emerald-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                                INCOMING_LINK
                            </h3>
                            <p className="text-lg font-bold text-white truncate leading-tight mb-0.5">
                                {identity || 'Unknown Identity'}
                            </p>
                            <p className="text-[9px] font-mono text-neutral-500 truncate bg-white/5 px-2 py-0.5 rounded w-fit">
                                ID: {peerId.slice(0, 12)}...
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-5">
                        <button 
                            onClick={onDecline}
                            disabled={isProcessing}
                            className="h-12 flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 text-neutral-300 hover:text-red-500 transition-all active:scale-95 font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                        >
                            <X size={16} /> TOLAK
                        </button>
                        
                        <button 
                            onClick={onAccept}
                            disabled={isProcessing}
                            className="h-12 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95 shadow-lg shadow-emerald-900/20 font-bold text-[10px] uppercase tracking-widest border border-emerald-500/50 disabled:opacity-80 disabled:cursor-wait"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> VERIFYING...
                                </>
                            ) : (
                                <>
                                    <Check size={16} strokeWidth={3} /> TERIMA
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
