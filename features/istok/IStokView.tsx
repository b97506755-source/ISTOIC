
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
    encryptData, decryptData
} from '../../utils/crypto'; 
import { TeleponanView } from '../teleponan/TeleponanView';
import { activatePrivacyShield } from '../../utils/privacyShield';
import { 
    Send, Zap, Radio, Server,
    Menu, Skull, PhoneCall, QrCode, ArrowRight,
    X, Flame, ShieldAlert, Image as ImageIcon, Loader2, ArrowLeft, Grid, Mic,
    Lock as LockIcon, History as HistoryIcon, Check, RefreshCw
} from 'lucide-react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { SidebarIStokContact, IStokSession } from './components/SidebarIStokContact';
import { ShareConnection } from './components/ShareConnection'; 
import { ConnectionNotification } from './components/ConnectionNotification';
import { CallNotification } from './components/CallNotification';
import { MessageNotification } from './components/MessageNotification';
import { AudioMessagePlayer } from './components/vn';
import { compressImage, ImageMessage } from './components/gambar';
import { IStokAuth } from './components/IStokAuth';
import { MediaDrawer } from './components/MediaDrawer';
import { IStokWalkieTalkie } from './components/IStokWalkieTalkie';
import { IStokInput } from './components/IStokInput';

// --- CONSTANTS ---
const CHUNK_SIZE = 16384; 

// --- TYPES ---
interface IStokProfile {
    id: string;        
    username: string;  
    bio?: string;
    publicKey?: string; 
    created: number;
}

interface Message {
    id: string;
    sender: 'ME' | 'THEM';
    senderId?: string; // Explicit sender ID for notification logic
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE';
    content: string; 
    timestamp: number;
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ';
    duration?: number;
    size?: number;
    fileName?: string; 
    isMasked?: boolean;
    mimeType?: string;
    ttl?: number; 
}

type AppMode = 'SELECT' | 'HOST' | 'JOIN' | 'CHAT';
type ConnectionStage = 'IDLE' | 'LOCATING_PEER' | 'FETCHING_RELAYS' | 'VERIFYING_KEYS' | 'ESTABLISHING_TUNNEL' | 'AWAITING_APPROVAL' | 'SECURE' | 'RECONNECTING';

// --- UTILS ---

const generateAnomalyIdentity = () => `ANOMALY-${Math.floor(Math.random() * 9000) + 1000}`;
const generateStableId = () => `ISTOK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

const triggerHaptic = (ms: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
    }
};

const notifySystem = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            new Notification(title, { 
                body, 
                icon: '/vite.svg', 
                tag: 'istok-msg', 
                renotify: true 
            } as any);
        } catch (e) {
            console.warn("Notification failed", e);
        }
    }
};

const requestNotificationPermission = () => {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
};

// FIXED: AudioContext Auto-Close to prevent memory leaks / max context limit
const playSound = (type: 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'CALL_RING' | 'ERROR' | 'BUZZ') => {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    let duration = 0.1;

    if (type === 'MSG_IN') {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
    } else if (type === 'MSG_OUT') {
        osc.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        duration = 0.05;
    } else if (type === 'CONNECT') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        duration = 0.2;
    } else if (type === 'CALL_RING') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.setValueAtTime(1000, now + 0.5);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.setValueAtTime(0, now + 0.5);
        duration = 0.5;
    } else if (type === 'BUZZ') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        duration = 0.3;
    }

    osc.start(now);
    osc.stop(now + duration);
    
    // GARBAGE COLLECTION
    setTimeout(() => {
        if (ctx.state !== 'closed') ctx.close();
    }, duration * 1000 + 100);
};

// --- SUB-COMPONENTS (MEMOIZED) ---

const BurnerTimer = ({ ttl, onBurn }: { ttl: number, onBurn: () => void }) => {
    const [timeLeft, setTimeLeft] = useState(ttl);
    useEffect(() => {
        if (timeLeft <= 0) { onBurn(); return; }
        const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, onBurn]);
    return (
        <div className="flex items-center gap-2 mt-1">
            <Flame size={10} className="text-red-500 animate-pulse" />
            <div className="w-full h-1 bg-red-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-1000 ease-linear" style={{width: `${(timeLeft/ttl)*100}%`}}></div>
            </div>
        </div>
    );
};

const FileMessageBubble = ({ fileName, size, content, mimeType }: any) => (
    <a href={`data:${mimeType};base64,${content}`} download={fileName} className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10"><span className="text-xs truncate max-w-[150px]">{fileName}</span></a>
);

const MessageBubble = React.memo(({ msg, setViewImage, onBurn }: { msg: Message, setViewImage: (img: string) => void, onBurn: (id: string) => void }) => {
    const [burnStarted, setBurnStarted] = useState(msg.type !== 'IMAGE');

    return (
        <div className={`flex ${msg.sender === 'ME' ? 'justify-end' : 'justify-start'} animate-fade-in mb-4`}>
            <div className={`max-w-[85%] flex flex-col ${msg.sender === 'ME' ? 'items-end' : 'items-start'}`}>
                <div className={`p-2 rounded-2xl text-sm border ${msg.sender === 'ME' ? 'bg-blue-600/20 border-blue-500/30 text-blue-100' : 'bg-[#1a1a1a] text-neutral-200 border-white/10'} ${msg.type === 'TEXT' ? 'px-4 py-3' : 'p-1'}`}>
                    {msg.type === 'IMAGE' ? 
                        <ImageMessage 
                            content={msg.content} 
                            size={msg.size} 
                            onClick={() => setViewImage(msg.content)} 
                            onReveal={() => setBurnStarted(true)} 
                        /> : 
                     msg.type === 'AUDIO' ? <AudioMessagePlayer src={msg.content} duration={msg.duration} isMasked={msg.isMasked} /> :
                     msg.type === 'FILE' ? <FileMessageBubble fileName={msg.fileName} size={msg.size} content={msg.content} mimeType={msg.mimeType}/> : msg.content}
                    
                    {msg.ttl && burnStarted && <BurnerTimer ttl={msg.ttl} onBurn={() => onBurn(msg.id)} />}
                </div>
                <div className="flex items-center gap-1 mt-1 px-1">
                    {msg.ttl && <ShieldAlert size={8} className="text-red-500" />}
                    <span className="text-[9px] text-neutral-600">{new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
            </div>
        </div>
    );
});

const SecureAttachmentModal = ({ image, onSend, onCancel }: { image: { base64: string, size: number }, onSend: () => void, onCancel: () => void }) => (
    <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
        <div className="w-full max-w-sm bg-[#09090b] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <LockIcon size={12} className="text-emerald-500"/> SECURE_ASSET_REVIEW
                </span>
                <button onClick={onCancel}><X size={16} className="text-neutral-500 hover:text-white"/></button>
            </div>
            
            <div className="p-4 flex flex-col items-center gap-4">
                <div className="relative w-full aspect-square bg-black/50 rounded-xl overflow-hidden border border-white/10 group">
                    <img src={`data:image/webp;base64,${image.base64.split(',')[1] || image.base64}`} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
                    <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded text-[8px] font-mono text-emerald-400 border border-emerald-900">
                        ENC_READY: {(image.size / 1024).toFixed(1)} KB
                    </div>
                </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3 border-t border-white/5 bg-white/[0.02]">
                <button onClick={onCancel} className="py-3 rounded-xl border border-white/10 text-neutral-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">ABORT</button>
                <button onClick={onSend} className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2">
                    <Send size={14} /> TRANSMIT
                </button>
            </div>
        </div>
    </div>
);

const ResumeSessionModal = ({ targetSession, onResume, onNew, onCancel }: { targetSession: IStokSession, onResume: () => void, onNew: () => void, onCancel: () => void }) => (
    <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
        <div className="w-full max-w-sm bg-[#09090b] border border-emerald-500/30 rounded-[32px] p-6 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative ring-1 ring-emerald-500/20">
            <button onClick={onCancel} className="absolute top-4 right-4 text-neutral-500 hover:text-white bg-white/5 rounded-full p-1"><X size={18}/></button>
            <div className="flex flex-col items-center gap-4 text-center mb-6 mt-2">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <HistoryIcon size={32} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">KNOWN FREQUENCY</h3>
                    <p className="text-xs text-neutral-400 mt-1 font-mono">
                        Target <span className="text-emerald-400 font-bold">{targetSession.customName || targetSession.name}</span> detected.
                    </p>
                </div>
            </div>
            <div className="space-y-3">
                <button onClick={onResume} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95">
                    <Check size={16} strokeWidth={3} /> RESUME SESSION
                </button>
                <div className="h-[1px] bg-white/5 w-full my-1"></div>
                <button onClick={onNew} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95">
                    <RefreshCw size={14} /> NEW HANDSHAKE
                </button>
            </div>
        </div>
    </div>
);

const ImageViewerModal = ({ src, onClose }: any) => (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4" onClick={onClose}><img src={src} className="max-w-full max-h-full rounded-lg border border-white/10 shadow-2xl"/></div>
);

// --- MAIN VIEW ---

export const IStokView: React.FC = () => {
    const [mode, setMode] = useState<AppMode>('SELECT');
    const [stage, setStage] = useState<ConnectionStage>('IDLE');
    
    // Feature States
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [resumeTargetSession, setResumeTargetSession] = useState<IStokSession | null>(null);
    const [showShare, setShowShare] = useState(false); 
    const [showSidebar, setShowSidebar] = useState(false);
    const [showMedia, setShowMedia] = useState(false);
    const [showWalkie, setShowWalkie] = useState(false);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [showCall, setShowCall] = useState(false); 

    // Data State
    const [myProfile, setMyProfile] = useLocalStorage<IStokProfile>('istok_profile_v1', {
        id: generateStableId(),
        username: generateAnomalyIdentity(),
        created: Date.now()
    });
    const [sessions, setSessions] = useLocalStorage<IStokSession[]>('istok_sessions', []);
    const [lastTargetId, setLastTargetId] = useLocalStorage<string>('istok_last_target_id', '');
    
    // Connection State
    const [targetPeerId, setTargetPeerId] = useState<string>('');
    const [accessPin, setAccessPin] = useState<string>('');
    const [pendingImage, setPendingImage] = useState<{base64: string, size: number} | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    
    // Transient State
    const [incomingConnectionRequest, setIncomingConnectionRequest] = useState<{ peerId: string, identity: string, conn: any } | null>(null);
    const [incomingCallObject, setIncomingCallObject] = useState<any>(null); 
    const [latestNotification, setLatestNotification] = useState<{ sender: string, text: string } | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');
    
    const [isRecording, setIsRecording] = useState(false);
    const [isSendingAudio, setIsSendingAudio] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [peerTyping, setPeerTyping] = useState(false);
    const [isPeerOnline, setIsPeerOnline] = useState(false);
    const [ttlMode, setTtlMode] = useState<number>(10);
    const [isVoiceMasked, setIsVoiceMasked] = useState(false);

    // Refs
    const chunkBuffer = useRef<Record<string, { chunks: string[], count: number, total: number }>>({});
    const pendingConnectionRef = useRef<{ id: string, pin: string } | null>(null);
    const peerRef = useRef<any>(null);
    const connRef = useRef<any>(null);
    const msgEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pinRef = useRef(accessPin); 
    const heartbeatIntervalRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<any>(null);

    // ACTIVE CHAT TRACKING (Safe Refs for Focus Logic)
    const activeChatIdRef = useRef<string | null>(null);

    const isRelayActive = !!process.env.VITE_METERED_API_KEY;

    // --- HANDLERS ---

    const handleToggleTtl = () => {
        if (ttlMode === 10) setTtlMode(60);
        else if (ttlMode === 60) setTtlMode(0);
        else setTtlMode(10);
    };
    
    const handleDeleteMessage = useCallback((id: string) => {
        setMessages(prev => prev.filter(m => m.id !== id));
    }, []);

    const handlePreConnectCheck = (id: string, pin?: string) => {
        const existing = sessions.find(s => s.id === id);
        if (existing) {
            setResumeTargetSession(existing);
            setTargetPeerId(existing.id);
            setAccessPin(pin || existing.pin);
            setShowResumeModal(true);
        } else {
            setTargetPeerId(id);
            if (pin) setAccessPin(pin);
            setLastTargetId(id);
            setMode('JOIN');
            setTimeout(() => joinSession(id, pin), 200);
        }
    };

    const handleResumeSession = () => {
        if (!resumeTargetSession) return;
        setShowResumeModal(false);
        setMode('JOIN');
        setAccessPin(resumeTargetSession.pin);
        setTimeout(() => joinSession(resumeTargetSession.id, resumeTargetSession.pin), 200);
    };

    const handleNewSession = () => {
         if (!resumeTargetSession) return;
         setShowResumeModal(false);
         setMessages([]); 
         setMode('JOIN');
         setTimeout(() => joinSession(resumeTargetSession.id, accessPin), 200);
    };

    const handleSelectContact = (session: IStokSession) => {
        setShowSidebar(false);
        setStage('IDLE');
        setTargetPeerId(session.id);
        setAccessPin(session.pin);
        
        setTimeout(() => {
            handlePreConnectCheck(session.id, session.pin);
        }, 50);
    };

    const handleRenameContact = (id: string, newName: string) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, customName: newName } : s));
    };

    const handleDeleteContact = (id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
    };

    const handleLeaveChat = () => {
        try {
            if (connRef.current) {
                connRef.current.close();
                connRef.current = null;
            }
            if (incomingConnectionRequest?.conn) {
                incomingConnectionRequest.conn.close();
            }
            if (incomingCallObject) {
                incomingCallObject.close();
            }
        } catch(e) {
            console.warn("Connection close warning", e);
        }
        
        setMessages([]);
        setStage('IDLE');
        setMode('SELECT');
        setTargetPeerId('');
        setIsPeerOnline(false);
        setIncomingConnectionRequest(null);
        setIncomingCallObject(null);
        
        activeChatIdRef.current = null; // Reset focus tracker
        
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };

    const acceptConnection = async () => {
        if (!incomingConnectionRequest) return;
        const { conn, identity, peerId } = incomingConnectionRequest;
        connRef.current = conn;
        
        setShowShare(false);

        const payload = JSON.stringify({ type: 'CONNECTION_ACCEPT', identity: myProfile.username });
        const encrypted = await encryptData(payload, pinRef.current);
        
        if (encrypted) {
            conn.send({ type: 'RESP', payload: encrypted });
            setStage('SECURE');
            setMode('CHAT');
            setIncomingConnectionRequest(null);
            
            // Set Active Chat
            setTargetPeerId(peerId);
            
            const now = Date.now();
            setSessions(prev => {
                const existing = prev.find(s => s.id === peerId);
                if (existing) {
                    return prev.map(s => s.id === peerId ? { ...s, lastSeen: now, status: 'ONLINE', name: identity } : s);
                }
                return [...prev, {
                    id: peerId,
                    name: identity,
                    lastSeen: now,
                    status: 'ONLINE',
                    pin: accessPin || pinRef.current,
                    createdAt: now
                }];
            });
            playSound('CONNECT');
            startHeartbeat();
        }
    };

    const declineConnection = () => {
        if (incomingConnectionRequest?.conn) incomingConnectionRequest.conn.close();
        setIncomingConnectionRequest(null);
    };

    // --- EFFECTS ---

    useEffect(() => {
        activatePrivacyShield();
        
        if (!myProfile.id) {
            setMyProfile({
                id: generateStableId(),
                username: generateAnomalyIdentity(),
                created: Date.now()
            });
        }

        if (lastTargetId && !targetPeerId) {
            setTargetPeerId(lastTargetId);
        }

        // Deep link handler
        try {
            const hash = window.location.hash;
            if (hash.includes('connect=')) {
                const params = new URLSearchParams(hash.replace('#', '?'));
                const connectId = params.get('connect');
                const key = params.get('key');
                if (connectId && key) {
                    handlePreConnectCheck(connectId, key);
                    pendingConnectionRef.current = { id: connectId, pin: key };
                    window.history.replaceState(null, '', window.location.pathname);
                }
            }
        } catch(e) {}
    }, []);

    useEffect(() => { 
        pinRef.current = accessPin;
    }, [accessPin]);

    // Update ref whenever target changes for notification logic
    useEffect(() => {
        if (mode === 'CHAT') {
            activeChatIdRef.current = targetPeerId;
        } else {
            activeChatIdRef.current = null;
        }
    }, [targetPeerId, mode]);

    useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, peerTyping]);

    // PEER INIT
    useEffect(() => {
        let mounted = true;
        
        if (peerRef.current && !peerRef.current.destroyed) return;

        const initPeer = async () => {
            try {
                const { Peer } = await import('peerjs');
                if (!mounted) return;
                
                // 1. CONFIG: ICE SERVERS (Global Connectivity Fix)
                let iceServers = [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    { urls: "stun:stun2.l.google.com:19302" },
                    { urls: "stun:stun3.l.google.com:19302" },
                    { urls: "stun:stun4.l.google.com:19302" },
                ];

                // Add Metered TURN if configured (Solves Symmetric NAT / 4G issues)
                const meteredKey = process.env.VITE_METERED_API_KEY;
                const meteredDomain = process.env.VITE_METERED_DOMAIN || 'global.metered.live';
                
                if (meteredKey) {
                    try {
                        const response = await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}`);
                        const turnConfig = await response.json();
                        if (Array.isArray(turnConfig)) {
                            iceServers = [...iceServers, ...turnConfig];
                        }
                    } catch(e) {
                        console.warn("Failed to fetch TURN credentials", e);
                    }
                }

                // 2. CONFIG: SIGNALING SERVER (Dynamic)
                const peerConfig: any = {
                    debug: 1,
                    config: {
                        iceServers: iceServers,
                        sdpSemantics: 'unified-plan',
                        iceCandidatePoolSize: 10,
                    }
                };

                const signalHost = process.env.VITE_PEER_HOST;
                const signalPort = process.env.VITE_PEER_PORT;
                const signalPath = process.env.VITE_PEER_PATH;
                const signalSecure = process.env.VITE_PEER_SECURE;

                if (signalHost) {
                    peerConfig.host = signalHost;
                    peerConfig.port = signalPort ? parseInt(signalPort) : 443;
                    peerConfig.path = signalPath || '/';
                    peerConfig.secure = signalSecure === 'true';
                } else {
                    peerConfig.secure = true;
                }
                
                const peer = new Peer(myProfile.id, peerConfig);

                peer.on('open', (id) => {
                    if (mounted) {
                        setStage('IDLE');
                        if (pendingConnectionRef.current && !showResumeModal) {
                            setTimeout(() => {
                                if (pendingConnectionRef.current) {
                                    joinSession(pendingConnectionRef.current.id, pendingConnectionRef.current.pin);
                                    pendingConnectionRef.current = null;
                                }
                            }, 1000);
                        }
                    }
                });

                peer.on('connection', (conn) => {
                    handleIncomingConnection(conn);
                });

                peer.on('call', (mediaConn) => {
                    if (showCall) {
                        mediaConn.close();
                        return;
                    }
                    if (incomingCallObject) return;

                    setShowShare(false);
                    console.log("Call received:", mediaConn.peer);
                    setIncomingCallObject(mediaConn);
                    playSound('CALL_RING');
                    
                    // Call Notification Logic: Only notify if not already handling call
                    if (document.hidden) {
                        notifySystem("SECURE CALL", "Encrypted voice channel requesting connection...");
                    }
                });
                
                peer.on('error', (err: any) => {
                    console.warn("Peer Error", err);
                    if (err.type === 'unavailable-id') setErrorMsg('ID_COLLISION_RETRYING');
                    if (err.type === 'peer-unavailable') setErrorMsg('TARGET OFFLINE');
                    if (err.type === 'fatal' || err.type === 'disconnected') setStage('RECONNECTING');
                });

                peerRef.current = peer;

            } catch (e) { 
                console.error("Peer Init Fail:", e);
                setErrorMsg("INIT_FAIL"); 
            }
        };
        initPeer();
        return () => {
            mounted = false;
            clearInterval(heartbeatIntervalRef.current);
            clearInterval(recordingIntervalRef.current);
        };
    }, [myProfile.id]);

    const startHeartbeat = () => {
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
            if (connRef.current?.open) {
                // Keep-alive ping logic can go here if needed
            } else {
                setIsPeerOnline(false);
            }
        }, 5000);
        setIsPeerOnline(true);
    };

    const joinSession = (id?: string, pin?: string) => {
        const target = id || targetPeerId;
        const key = pin || accessPin;
        if (!target || !key) return;

        if (!peerRef.current || peerRef.current.destroyed || !peerRef.current.open) {
            setErrorMsg("NETWORK_OFFLINE");
            return;
        }

        setStage('LOCATING_PEER');
        
        try {
            const conn = peerRef.current.connect(target, { reliable: true });
            
            if (!conn) {
                 setErrorMsg('CONNECTION_FAILED');
                 setStage('IDLE');
                 return;
            }

            connRef.current = conn;

            conn.on('open', async () => {
                setStage('VERIFYING_KEYS');
                const payload = JSON.stringify({ type: 'CONNECTION_REQUEST', identity: myProfile.username });
                const encrypted = await encryptData(payload, key);
                
                if (encrypted) {
                    conn.send({ type: 'REQ', payload: encrypted });
                    setStage('AWAITING_APPROVAL');
                } else {
                    setStage('IDLE');
                    setErrorMsg('ENCRYPTION_FAILED');
                }
            });

            conn.on('data', (data: any) => handleData(data));
            conn.on('close', handleDisconnect);
            conn.on('error', () => {
                setErrorMsg('TARGET_OFFLINE');
                setStage('IDLE');
            });

        } catch(e) {
            console.error("Connection attempt failed", e);
            setErrorMsg('CONNECTION_ERROR');
            setStage('IDLE');
        }
    };

    const handleIncomingConnection = (conn: any) => {
        conn.on('data', (data: any) => handleData(data, conn));
        conn.on('close', handleDisconnect);
    };

    const handleData = async (data: any, incomingConn?: any) => {
        // --- CHUNK HANDLER (CORRUPTION FIX) ---
        if (data.type === 'CHUNK') {
            const { transferId, idx, total, data: chunkData } = data;
            
            if (!chunkBuffer.current[transferId]) {
                chunkBuffer.current[transferId] = { chunks: new Array(total), count: 0, total };
            }
            const buffer = chunkBuffer.current[transferId];
            
            // Only add if not already present
            if (!buffer.chunks[idx]) {
                buffer.chunks[idx] = chunkData;
                buffer.count++;
            }
            
            if (buffer.count === total) {
                // Verify strict reassembly
                const fullPayload = buffer.chunks.join('');
                delete chunkBuffer.current[transferId]; // Clean up memory
                handleData({ type: 'MSG', payload: fullPayload });
            }
            return;
        }

        if (data.type === 'REQ') {
            const json = await decryptData(data.payload, pinRef.current);
            if (json) {
                const req = JSON.parse(json);
                if (req.type === 'CONNECTION_REQUEST') {
                    setShowShare(false);
                    setIncomingConnectionRequest({ 
                        peerId: incomingConn.peer, 
                        identity: req.identity, 
                        conn: incomingConn 
                    });
                    playSound('MSG_IN');
                    notifySystem("SECURE UPLINK", `Connection request from ${req.identity}`);
                }
            }
        } else if (data.type === 'RESP') {
            const json = await decryptData(data.payload, pinRef.current);
            if (json) {
                const res = JSON.parse(json);
                if (res.type === 'CONNECTION_ACCEPT') {
                    setStage('SECURE');
                    setMode('CHAT');
                    
                    // IMPORTANT: Set active ID for notification logic
                    activeChatIdRef.current = connRef.current.peer;
                    setTargetPeerId(connRef.current.peer);

                    playSound('CONNECT');
                    startHeartbeat();
                    const now = Date.now();
                    setSessions(prev => {
                        const existing = prev.find(s => s.id === connRef.current.peer);
                        if (existing) return prev.map(s => s.id === connRef.current.peer ? { ...s, lastSeen: now, status: 'ONLINE', name: res.identity } : s);
                        return [...prev, {
                            id: connRef.current.peer,
                            name: res.identity,
                            lastSeen: now,
                            status: 'ONLINE',
                            pin: accessPin || pinRef.current,
                            createdAt: now
                        }];
                    });
                }
            }
        } else if (data.type === 'MSG') {
            const json = await decryptData(data.payload, pinRef.current);
            if (json) {
                const msg = JSON.parse(json);
                const isFromActivePeer = activeChatIdRef.current === connRef.current?.peer;
                const isWindowFocused = document.hasFocus();

                // State Update
                setMessages(prev => [...prev, { ...msg, sender: 'THEM', status: 'READ' }]);
                
                // NOTIFICATION LOGIC (NO DUPLICATES)
                if (isWindowFocused && isFromActivePeer) {
                    // We are looking at the chat -> Just play soft sound
                    triggerHaptic(50);
                } else {
                    // Background or different chat -> Full Notification
                    playSound('MSG_IN');
                    const textPreview = msg.type === 'TEXT' ? msg.content : `Sent a ${msg.type}`;
                    setLatestNotification({ sender: 'ANOMALY', text: textPreview });
                    notifySystem(msg.senderId || 'ANOMALY', textPreview);
                }
            }
        } else if (data.type === 'SIGNAL') {
             if (data.action === 'TYPING') {
                 setPeerTyping(true);
                 setTimeout(() => setPeerTyping(false), 2000);
             } else if (data.action === 'BUZZ') {
                 triggerHaptic([200, 100, 200]);
                 playSound('BUZZ');
             } else if (data.action === 'NUKE') {
                 setMessages([]);
                 alert("PEER INITIATED PROTOCOL: NUKE. History Cleared.");
             }
        }
    };

    const sendMessage = async (type: string, content: string, extraData: any = {}) => {
        if (!connRef.current || !content) return;
        
        const messageId = crypto.randomUUID();
        const timestamp = Date.now();
        
        const rawPayload = {
            id: messageId,
            sender: 'THEM',
            type,
            content,
            timestamp,
            ttl: ttlMode > 0 ? ttlMode : undefined,
            ...extraData
        };

        const encrypted = await encryptData(JSON.stringify(rawPayload), pinRef.current);
        
        if (encrypted) {
            // --- CHUNKING LOGIC (FIXED) ---
            if (encrypted.length > CHUNK_SIZE) {
                 const transferId = crypto.randomUUID();
                 const total = Math.ceil(encrypted.length / CHUNK_SIZE);
                 
                 (async () => {
                     for (let i = 0; i < total; i++) {
                         const chunk = encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                         connRef.current.send({
                             type: 'CHUNK',
                             transferId,
                             idx: i,
                             total,
                             data: chunk
                         });
                         // Safe delay for WebRTC buffers
                         await new Promise(r => setTimeout(r, 10)); 
                     }
                 })();
            } else {
                 connRef.current.send({ type: 'MSG', payload: encrypted });
            }
            
            setMessages(prev => [...prev, {
                id: messageId,
                sender: 'ME',
                type: type as any,
                content,
                timestamp,
                status: 'SENT',
                ttl: ttlMode > 0 ? ttlMode : undefined,
                ...extraData
            }]);
            playSound('MSG_OUT');
        }
    };

    const sendSystemSignal = async (type: string) => {
        if (!connRef.current) return;
        connRef.current.send({ type: 'SIGNAL', action: type });
    };

    const startRecording = async () => {
        try {
            // Supported MIME check
            const mimeType = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4', // iOS priority
                'audio/ogg;codecs=opus'
            ].find(type => MediaRecorder.isTypeSupported(type)) || '';

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                // IMMEDIATE CLEANUP
                stream.getTracks().forEach(track => track.stop());
                
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
                
                // Validate size (avoid empty recordings)
                if (audioBlob.size < 100) return; 

                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result as string;
                    const cleanBase64 = base64Audio.split(',')[1];
                    if (isSendingAudio) { 
                        sendMessage('AUDIO', cleanBase64, { duration: recordingTime, isMasked: isVoiceMasked, mimeType });
                    }
                    setIsSendingAudio(false);
                };
                reader.readAsDataURL(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
            setIsSendingAudio(true);
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (e) {
            console.error("Mic error", e);
            alert("Microphone access denied. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
        }
    };

    const handleFileSelect = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (evt: any) => {
            const rawBase64 = evt.target.result;
            
            if (file.type.startsWith('image/')) {
                try {
                    const compressed = await compressImage(file);
                    setPendingImage({ base64: compressed.base64, size: compressed.size });
                } catch {
                    const b64 = rawBase64.split(',')[1];
                    sendMessage('IMAGE', b64, { size: file.size });
                }
            } else {
                const b64 = rawBase64.split(',')[1];
                sendMessage('FILE', b64, { fileName: file.name, size: file.size, mimeType: file.type });
            }
        };
        reader.readAsDataURL(file);
    };
    
    const handleConfirmImageSend = () => {
        if (pendingImage) {
            const cleanBase64 = pendingImage.base64.split(',')[1];
            sendMessage('IMAGE', cleanBase64, { size: pendingImage.size });
            setPendingImage(null);
        }
    };

    const handleDisconnect = () => {
        setStage('RECONNECTING');
        setIsPeerOnline(false);
        setErrorMsg('PEER_DISCONNECTED');
    };

    const messageList = useMemo(() => (
        // Added overscroll-none to prevent rubber banding on the message list
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scroll bg-noise pb-4 overscroll-none">
            {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} setViewImage={setViewImage} onBurn={handleDeleteMessage} />
            ))}
            <div ref={msgEndRef} />
        </div>
    ), [messages, handleDeleteMessage]);

    // --- RENDER MODES ---

    if (mode === 'SELECT' || mode === 'HOST' || mode === 'JOIN') {
        return (
            <div className="h-[100dvh] w-full bg-[#050505] flex flex-col items-center justify-center px-6 relative overflow-hidden font-sans">
                 
                 {showResumeModal && resumeTargetSession && (
                     <ResumeSessionModal 
                        targetSession={resumeTargetSession}
                        onResume={handleResumeSession}
                        onNew={handleNewSession}
                        onCancel={() => setShowResumeModal(false)}
                     />
                 )}
                 
                 {incomingConnectionRequest && (
                     <ConnectionNotification 
                        identity={incomingConnectionRequest.identity}
                        peerId={incomingConnectionRequest.peerId}
                        onAccept={acceptConnection}
                        onDecline={declineConnection}
                     />
                 )}
                 {incomingCallObject && !showCall && (
                     <CallNotification 
                        identity={sessions.find(s => s.id === incomingCallObject.peer)?.name || 'UNKNOWN Caller'}
                        onAnswer={() => {
                            setShowCall(true);
                        }}
                        onDecline={() => {
                            incomingCallObject.close();
                            setIncomingCallObject(null);
                        }}
                     />
                 )}

                 <SidebarIStokContact 
                    isOpen={showSidebar}
                    onClose={() => setShowSidebar(false)}
                    sessions={sessions}
                    onSelect={handleSelectContact}
                    onRename={handleRenameContact}
                    onDelete={handleDeleteContact}
                    currentPeerId={myProfile.id}
                />
                
                <div className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-6 z-20">
                    <button onClick={() => setShowSidebar(true)} className="p-3 bg-white/5 rounded-full text-white"><Menu size={20} /></button>
                </div>

                {/* Back Button if not in SELECT mode */}
                {mode !== 'SELECT' && (
                    <button onClick={() => { setMode('SELECT'); setStage('IDLE'); }} className="absolute top-[calc(env(safe-area-inset-top)+1rem)] left-6 text-neutral-500 hover:text-white flex items-center gap-2 text-xs font-bold z-20">
                        <ArrowLeft size={16} /> ABORT
                    </button>
                )}

                {mode === 'SELECT' ? (
                    <IStokAuth 
                        identity={myProfile.username}
                        onRegenerateIdentity={() => setMyProfile({ ...myProfile, username: generateAnomalyIdentity() })}
                        onHost={() => {
                            const newPin = Math.floor(100000 + Math.random()*900000).toString();
                            setAccessPin(newPin);
                            setMode('HOST');
                            requestNotificationPermission();
                        }}
                        onJoin={(id, pin) => {
                            setTargetPeerId(id);
                            setAccessPin(pin);
                            setMode('JOIN');
                            requestNotificationPermission();
                            setTimeout(() => joinSession(id, pin), 200);
                        }}
                        errorMsg={errorMsg}
                        onErrorClear={() => setErrorMsg('')}
                        isRelayActive={isRelayActive}
                    />
                ) : mode === 'HOST' ? (
                     <div className="w-full max-w-md bg-[#09090b] border border-white/10 p-8 rounded-[32px] text-center space-y-6">
                         <div className="relative inline-block mb-4">
                             <div className="absolute inset-0 bg-emerald-500 blur-[60px] opacity-20 animate-pulse"></div>
                             <Server className="text-emerald-500 relative z-10 mx-auto" size={48} />
                         </div>
                         <h2 className="text-xl font-black text-white animate-pulse">BROADCASTING...</h2>
                         <div className="p-4 bg-black rounded-xl border border-white/5">
                            <p className="text-[9px] text-neutral-500 mb-1">YOUR ID</p>
                            <code className="text-emerald-500 text-xs select-all block mb-4 break-all">{myProfile.id}</code>
                            <p className="text-[9px] text-neutral-500 mb-1">PIN</p>
                            <p className="text-xl font-black text-white tracking-[0.5em]">{accessPin}</p>
                         </div>
                         <button onClick={() => setShowShare(true)} className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"><QrCode size={14} /> SHARE CONNECTION</button>
                     </div>
                ) : (
                     <div className="w-full max-w-md space-y-4">
                         <div className="flex flex-col items-center justify-center gap-6 py-10">
                             <div className="relative">
                                 <div className="w-24 h-24 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
                                 <Radio className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500" size={32} />
                             </div>
                             <div className="text-center space-y-1">
                                 <h2 className="text-xl font-black text-white uppercase tracking-tight animate-pulse">{stage.replace('_', ' ')}</h2>
                                 <p className="text-xs text-neutral-500 font-mono">ESTABLISHING SECURE TUNNEL</p>
                             </div>
                         </div>
                     </div>
                )}

                {showShare && <ShareConnection peerId={myProfile.id} pin={accessPin} onClose={() => setShowShare(false)} />}
            </div>
        );
    }

    // CHAT MODE
    return (
        <div className="h-[100dvh] w-full bg-[#050505] flex flex-col font-sans relative overflow-hidden">
             
             {viewImage && <ImageViewerModal src={viewImage} onClose={() => setViewImage(null)} />}
             
             {pendingImage && (
                 <SecureAttachmentModal 
                    image={pendingImage}
                    onSend={handleConfirmImageSend}
                    onCancel={() => setPendingImage(null)}
                 />
             )}
             
             {latestNotification && (
                 <MessageNotification 
                    senderName={latestNotification.sender} 
                    messagePreview={latestNotification.text} 
                    onDismiss={() => setLatestNotification(null)} 
                    onClick={() => { 
                        msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
                        setLatestNotification(null); 
                    }} 
                />
             )}
             
             {incomingConnectionRequest && <ConnectionNotification identity={incomingConnectionRequest.identity} peerId={incomingConnectionRequest.peerId} onAccept={acceptConnection} onDecline={declineConnection} />}
             {incomingCallObject && !showCall && (
                 <CallNotification 
                    identity={sessions.find(s => s.id === incomingCallObject.peer)?.name || 'UNKNOWN Caller'}
                    onAnswer={() => {
                        setShowCall(true);
                    }}
                    onDecline={() => {
                        incomingCallObject.close();
                        setIncomingCallObject(null);
                    }}
                 />
             )}

             {showCall && (
                 <TeleponanView 
                    onClose={() => { 
                        setShowCall(false); 
                        setIncomingCallObject(null); 
                    }} 
                    existingPeer={peerRef.current} 
                    initialTargetId={targetPeerId} 
                    incomingCall={incomingCallObject} 
                    secretPin={accessPin || pinRef.current} 
                 />
             )}

             <MediaDrawer 
                isOpen={showMedia}
                onClose={() => setShowMedia(false)}
                messages={messages}
                onViewImage={setViewImage}
             />

             {showWalkie && (
                 <IStokWalkieTalkie 
                    onClose={() => setShowWalkie(false)}
                    onSendAudio={(base64, dur, size) => sendMessage('AUDIO', base64, { duration: dur, size })}
                    latestMessage={messages[messages.length - 1]}
                 />
             )}
             
             <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#09090b] z-10 pt-[calc(env(safe-area-inset-top)+1rem)]">
                 <div className="flex items-center gap-3">
                     <button onClick={handleLeaveChat} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                         <ArrowLeft size={20} />
                     </button>
                     <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_#10b981] ${isPeerOnline ? 'bg-emerald-500' : 'bg-neutral-600'}`}></div>
                     <div>
                         <h1 className="text-xs font-black text-white tracking-widest">SECURE_LINK</h1>
                         {peerTyping ? <span className="text-[8px] text-emerald-500 animate-pulse">TYPING...</span> : <span className="text-[8px] text-neutral-500 font-mono">{targetPeerId.slice(0,8)}...</span>}
                     </div>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={() => setShowMedia(true)} className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"><Grid size={18}/></button>
                     <button onClick={() => sendSystemSignal('BUZZ')} className="p-2 rounded-full hover:bg-white/10 text-yellow-500 transition-colors" title="SEND BUZZ"><Zap size={18} fill="currentColor" /></button>
                     <button onClick={() => setShowCall(true)} className="p-2 rounded-full hover:bg-white/10 text-emerald-500 hover:text-white" title="SECURE CALL"><PhoneCall size={18}/></button>
                     <div className="w-[1px] h-6 bg-white/10 mx-1 self-center"></div>
                     <button onClick={() => { if(confirm("NUKE CHAT PROTOCOL: This will clear history on BOTH devices. Proceed?")) sendSystemSignal('NUKE'); }} className="p-2 rounded-full hover:bg-red-500/20 text-red-500 transition-colors" title="NUKE PROTOCOL"><Skull size={18} /></button>
                 </div>
             </div>

             {messageList}
             <IStokInput 
                onSend={(txt:any) => sendMessage('TEXT', txt)}
                onTyping={() => sendSystemSignal('TYPING')}
                disabled={mode !== 'CHAT'}
                isRecording={isRecording}
                recordingTime={recordingTime}
                isVoiceMasked={isVoiceMasked}
                onToggleMask={() => setIsVoiceMasked(!isVoiceMasked)}
                onStartRecord={startRecording}
                onStopRecord={stopRecording}
                onAttach={() => fileInputRef.current?.click()}
                ttlMode={ttlMode}
                onToggleTtl={handleToggleTtl}
                onWalkieTalkie={() => setShowWalkie(true)}
             />
             <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,video/*,audio/*,.pdf,.doc,.txt" />
        </div>
    );
};
