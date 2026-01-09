import React from 'react';
import { Check, CheckCheck, Clock, FileText, Download, Sparkles } from 'lucide-react';
import { ImageMessage } from './gambar'; // Pastikan file gambar.tsx ada di folder yang sama
import { AudioMessagePlayer } from './vn'; // Pastikan file vn.tsx ada di folder yang sama

// --- TIPE DATA ---
export interface Message {
    id: string;
    sender: 'ME' | 'THEM' | 'AI';
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'AI_RESPONSE';
    content: string; 
    timestamp: number;
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ';
    duration?: number;
    size?: number;
    mimeType?: string;
    fileName?: string;
    ttl?: number;
}

interface MessageBubbleProps {
    msg: Message;
    setViewImage: (url: string) => void;
}

// --- KOMPONEN UTAMA ---
export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ msg, setViewImage }) => {
    const isMe = msg.sender === 'ME';
    const isAI = msg.sender === 'AI';

    // Helper untuk merender konten berdasarkan tipe pesan
    const renderContent = () => {
        switch (msg.type) {
            case 'IMAGE':
                return (
                    <ImageMessage 
                        content={msg.content} 
                        size={msg.size} 
                        mimeType={msg.mimeType} 
                        onClick={() => setViewImage(msg.content)} 
                    />
                );
            case 'AUDIO':
                return (
                    <AudioMessagePlayer 
                        src={msg.content} 
                        duration={msg.duration} 
                        mimeType={msg.mimeType}
                    />
                );
            case 'FILE':
                return (
                    <div className="flex items-center gap-3 p-2 min-w-[160px]">
                        <div className="p-2 bg-white/10 rounded-lg flex-shrink-0">
                            <FileText size={24} className="text-white" />
                        </div>
                        <div className="flex-1 overflow-hidden min-w-0">
                            <p className="text-xs font-bold text-white truncate w-full">
                                {msg.fileName || 'Dokumen Tanpa Nama'}
                            </p>
                            <p className="text-[10px] text-neutral-400">
                                {msg.size ? (msg.size / 1024).toFixed(1) : '0'} KB • {msg.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
                            </p>
                        </div>
                        {/* Tombol download (logika download bisa ditambahkan nanti) */}
                        <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white">
                            <Download size={16} />
                        </button>
                    </div>
                );
            case 'AI_RESPONSE':
                return (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1 opacity-70">
                            <Sparkles size={10} className="text-purple-400" />
                            <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">AI ASSISTANT</span>
                        </div>
                        <span className="whitespace-pre-wrap leading-relaxed break-words text-sm block min-w-[20px]">
                            {msg.content}
                        </span>
                    </div>
                );
            default: // TEXT
                return (
                    <span className="whitespace-pre-wrap leading-relaxed break-words text-sm block min-w-[20px]">
                        {msg.content}
                    </span>
                );
        }
    };

    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 group animate-slide-up w-full`}>
            <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                
                {/* Bubble Container */}
                <div 
                    className={`
                        relative rounded-2xl border shadow-sm transition-all duration-200
                        ${isMe 
                            ? 'bg-emerald-900/40 border-emerald-500/30 text-emerald-50 rounded-tr-none' 
                            : isAI
                                ? 'bg-purple-900/20 border-purple-500/30 text-neutral-200 rounded-tl-none hover:bg-purple-900/30'
                                : 'bg-[#1a1a1a] text-neutral-200 border-white/10 rounded-tl-none hover:bg-[#252525]'
                        }
                        ${msg.type !== 'TEXT' && msg.type !== 'AI_RESPONSE' ? 'p-1' : 'px-4 py-2'}
                    `}
                >
                    {renderContent()}
                </div>
                
                {/* Meta Data (Waktu & Status) */}
                <div className="flex items-center gap-1.5 mt-1 px-1 opacity-70 select-none">
                     <span className="text-[9px] font-mono text-neutral-500">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </span>
                     
                     {isMe && (
                         <div className="flex items-center ml-1" title={`Status: ${msg.status}`}>
                             {msg.status === 'PENDING' && <Clock size={10} className="text-neutral-500" />}
                             {msg.status === 'SENT' && <Check size={12} className="text-neutral-500" />}
                             {msg.status === 'DELIVERED' && <CheckCheck size={12} className="text-neutral-500" />}
                             {msg.status === 'READ' && <CheckCheck size={12} className="text-emerald-400" />}
                         </div>
                     )}
                </div>

            </div>
        </div>
    );
});

// Display name berguna untuk debugging di React DevTools
MessageBubble.displayName = 'MessageBubble';