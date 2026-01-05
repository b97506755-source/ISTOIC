
import React, { useState, memo } from 'react';
import { Send, Zap, Radio, Mic, Flame } from 'lucide-react';

interface IStokInputProps {
    onSend: (text: string) => void;
    onTyping: () => void;
    disabled: boolean;
    isRecording: boolean;
    recordingTime: number;
    isVoiceMasked: boolean;
    onToggleMask: () => void;
    onStartRecord: () => void;
    onStopRecord: () => void;
    onAttach: () => void;
    ttlMode: number;
    onToggleTtl: () => void;
    onWalkieTalkie: () => void;
}

export const IStokInput = memo(({ 
    onSend, 
    onTyping, 
    disabled, 
    isRecording, 
    onStartRecord, 
    onStopRecord, 
    onAttach, 
    ttlMode, 
    onToggleTtl, 
    onWalkieTalkie 
}: IStokInputProps) => {
    const [text, setText] = useState('');

    return (
        <div className="bg-[#09090b] border-t border-white/10 p-3 z-20 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <div className="flex items-center justify-between mb-2 px-1">
                 <button onClick={onToggleTtl} className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all ${ttlMode > 0 ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-white/5 border-white/5 text-neutral-500'}`}>
                    <Flame size={10} className={ttlMode > 0 ? 'fill-current' : ''} />
                    {ttlMode > 0 ? `${ttlMode}s BURN` : 'PERSIST'}
                 </button>
                 <span className="text-[8px] font-mono text-neutral-600">E2EE_ACTIVE</span>
            </div>

            <div className="flex gap-2 items-end">
                <button onClick={onAttach} className="p-3 bg-white/5 rounded-full text-neutral-400 hover:text-white transition-colors"><Zap size={20}/></button>
                <button onClick={onWalkieTalkie} className="p-3 bg-white/5 rounded-full text-neutral-400 hover:text-emerald-500 transition-colors"><Radio size={20}/></button>
                
                <div className="flex-1 bg-white/5 rounded-2xl px-4 py-3 border border-white/5 focus-within:border-emerald-500/30 transition-colors">
                    <input 
                        value={text} 
                        onChange={e=>{setText(e.target.value); onTyping();}} 
                        onKeyDown={e=>e.key==='Enter'&&text.trim()&&(onSend(text),setText(''))} 
                        placeholder={isRecording ? "Recording..." : "Message..."} 
                        className="w-full bg-transparent outline-none text-white text-sm placeholder:text-neutral-600" 
                        disabled={disabled||isRecording}
                        // Mobile UX Improvements
                        autoCapitalize="sentences"
                        autoComplete="off"
                        enterKeyHint="send"
                    />
                </div>
                {text.trim() ? (
                    <button onClick={()=>{onSend(text);setText('');}} className="p-3 bg-blue-600 rounded-full text-white shadow-lg shadow-blue-900/20 active:scale-90 transition-transform"><Send size={20}/></button>
                ) : (
                    <button 
                        onMouseDown={onStartRecord} 
                        onMouseUp={onStopRecord} 
                        onTouchStart={onStartRecord} 
                        onTouchEnd={onStopRecord} 
                        className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white shadow-[0_0_15px_red] animate-pulse' : 'bg-white/5 text-neutral-400'}`}
                    >
                        <Mic size={20}/>
                    </button>
                )}
            </div>
        </div>
    );
});
