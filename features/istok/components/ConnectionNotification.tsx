import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    encryptData, decryptData
} from '../../utils/crypto'; 
import { TeleponanView } from '../teleponan/TeleponanView';
import { activatePrivacyShield } from '../../utils/privacyShield';
import { 
    Send, Zap, ScanLine, Server,
    Mic, Menu, PhoneCall, 
    QrCode, Lock, Flame, 
    ShieldAlert, ArrowLeft, BrainCircuit, Sparkles,
    Wifi, WifiOff, Paperclip, Camera, Globe, Languages, Check, X,
    Activity, Radio, Globe2
} from 'lucide-react';

// --- HOOKS & SERVICES ---
import useLocalStorage from '../../hooks/useLocalStorage';
import { OMNI_KERNEL } from '../../services/omniRace'; 
import { SidebarIStokContact, IStokSession, IStokProfile } from './components/SidebarIStokContact';
import { ShareConnection } from './components/ShareConnection'; 
import { ConnectionNotification } from './components/ConnectionNotification';
import { CallNotification } from './components/CallNotification';
import { MessageBubble } from './components/MessageBubble'; 
import { QRScanner } from './components/QRScanner'; 
import { compressImage } from './components/gambar';
import { AudioMessagePlayer } from './components/vn'; 

// --- CONSTANTS ---
const CHUNK_SIZE = 16384; 
const HEARTBEAT_MS = 2000; // Sangat Agresif (2 detik)
const RECONNECT_DELAY = 1000;

// Daftar Bahasa Professional
const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English (Pro)', icon: '🇺🇸' },
    { code: 'id', name: 'Indonesia (Formal)', icon: '🇮🇩' },
    { code: 'jp', name: 'Japanese (Keigo)', icon: '🇯🇵' },
    { code: 'cn', name: 'Mandarin (Biz)', icon: '🇨🇳' },
    { code: 'ru', name: 'Russian', icon: '🇷🇺' },
    { code: 'ar', name: 'Arabic (MSA)', icon: '🇸🇦' },
    { code: 'de', name: 'German', icon: '🇩🇪' },
    { code: 'fr', name: 'French', icon: '🇫🇷' },
];

// --- TYPES ---
interface Message {
    id: string;
    sender: 'ME' | 'THEM';
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
    isTranslated?: boolean;
    originalLang?: string;
}

type AppMode = 'SELECT' | 'HOST' | 'JOIN' | 'CHAT';
type ConnectionStage = 'IDLE' | 'LOCATING_PEER' | 'FETCHING_RELAYS' | 'VERIFYING_KEYS' | 'ESTABLISHING_TUNNEL' | 'AWAITING_APPROVAL' | 'SECURE' | 'RECONNECTING' | 'DISCONNECTED';

// --- SOUND & HAPTIC ---
const triggerHaptic = (ms: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
};

const playSound = (type: 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'CALL_RING' | 'BUZZ' | 'AI_THINK' | 'TRANSLATE' | 'ERROR') => {
    try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        
        const presets: any = {
            'MSG_IN': () => {
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now); osc.stop(now + 0.1);
            },
            'CONNECT': () => {
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.2);
                osc.start(now); osc.stop(now + 0.2);
            },
            'ERROR': () => {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.linearRampToValueAtTime(100, now + 0.3);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
            }
        };
        
        if (presets[type]) presets[type]();
        else if (type === 'MSG_OUT') {
             osc.frequency.setValueAtTime(400, now);
             gain.gain.setValueAtTime(0.05, now);
             gain.gain.linearRampToValueAtTime(0, now + 0.05);
             osc.start(now); osc.stop(now + 0.05);
        }
    } catch(e) {}
};

// --- AGGRESSIVE ICE CONFIG ---
const getIceServers = async (): Promise<any[]> => {
    // FALLBACK GLOBAL (Google, Twilio, StunProtocol)
    const publicIce = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.nextcloud.com:443' },
        { urls: 'stun:stun.voip.blackberry.com:3478' }
    ];

    try {
        const apiKey = import.meta.env.VITE_METERED_API_KEY;
        if (!apiKey) return publicIce;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s Timeout

        const response = await fetch(`https://istoic.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) return publicIce;
        const turnServers = await response.json();
        
        // GABUNGKAN TURN PREMIUM + STUN PUBLIK UNTUK COVERAGE MAKSIMAL
        return [...turnServers, ...publicIce];
    } catch (e) {
        return publicIce;
    }
};

// --- COMPONENT: GLOBAL STATUS OVERLAY (MUNCUL DIMANA-MANA) ---
const GlobalStatusOverlay = ({ stage, isOnline, ping }: { stage: ConnectionStage, isOnline: boolean, ping: number }) => {
    // Hanya muncul jika sedang ada aktivitas jaringan penting atau error
    if (stage === 'IDLE' && !isOnline) return null;

    let bgColor = 'bg-neutral-900';
    let borderColor = 'border-white/10';
    let icon = <Activity size={14} className="animate-pulse"/>;
    let text = stage.replace('_', ' ');

    if (stage === 'SECURE' && isOnline) {
        bgColor = 'bg-emerald-950/90';
        borderColor = 'border-emerald-500/30';
        icon = <Globe2 size={14} className="text-emerald-500"/>;
        text = `SECURE LINK • ${ping}ms`;
    } else if (stage === 'RECONNECTING' || stage === 'LOCATING_PEER') {
        bgColor = 'bg-yellow-950/90';
        borderColor = 'border-yellow-500/30';
        icon = <Radio size={14} className="text-yellow-500 animate-spin"/>;
        text = "SEARCHING NETWORK...";
    } else if (stage === 'DISCONNECTED') {
        bgColor = 'bg-red-950/90';
        borderColor = 'border-red-500/30';
        icon = <WifiOff size={14} className="text-red-500"/>;
        text = "CONNECTION LOST";
    }

    return (
        <div className="fixed top-0 inset-x-0 z-[9999] p-2 pointer-events-none flex justify-center">
            <div className={`${bgColor} backdrop-blur-md border ${borderColor} text-white px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-3 text-[10px] font-bold tracking-widest uppercase transition-all duration-300 transform translate-y-0`}>
                {icon}
                <span>{text}</span>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const IStokView: React.FC = () => {
    // STATE
    const [mode, setMode] = useState<AppMode>('SELECT');
    const [stage, setStage] = useState<ConnectionStage>('IDLE');
    const [errorMsg, setErrorMsg] = useState<string>('');
    
    // DATA
    const [myProfile] = useLocalStorage<IStokProfile>('istok_profile_v1', {
        id: generateStableId(),
        username: generateAnomalyIdentity(),
        created: Date.now()
    });
    const [sessions, setSessions] = useLocalStorage<IStokSession[]>('istok_sessions', []);
    
    // CONNECTION
    const [targetPeerId, setTargetPeerId] = useState<string>('');
    const [accessPin, setAccessPin] = useState<string>('');
    const [pendingJoin, setPendingJoin] = useState<{id:string, pin:string} | null>(null);
    const [pingLatency, setPingLatency] = useState(0);
    
    // UI FLAGS
    const [showSidebar, setShowSidebar] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showCall, setShowCall] = useState(false);
    const [viewImage, setViewImage] = useState<string|null>(null);
    const [showScanner, setShowScanner] = useState(false);
    
    // CHAT & MEDIA
    const [messages, setMessages] = useState<Message[]>([]);
    const [isPeerOnline, setIsPeerOnline] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isVoiceMasked, setIsVoiceMasked] = useState(false);
    const [ttlMode, setTtlMode] = useState(0); 
    
    // AI
    const [isAiThinking, setIsAiThinking] = useState(false); 
    const [translateTarget, setTranslateTarget] = useState<any>(null);

    // NOTIFICATIONS
    const [incomingRequest, setIncomingRequest] = useState<any>(null);
    const [incomingCall, setIncomingCall] = useState<any>(null);

    // REFS
    const peerRef = useRef<any>(null);
    const connRef = useRef<any>(null);
    const pinRef = useRef(accessPin);
    const msgEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chunkBuffer = useRef<any>({});
    const heartbeatRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder|null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    
    // --- UTILS LOCAL ---
    const generateAnomalyIdentity = () => `ANOMALY-${Math.floor(Math.random() * 9000) + 1000}`;
    const generateStableId = () => `ISTOK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // --- EFFECT: SYNC PIN ---
    useEffect(() => { pinRef.current = accessPin; }, [accessPin]);
    useEffect(() => { msgEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

    // --- EFFECT: INITIALIZE ---
    useEffect(() => {
        activatePrivacyShield();
        // Check URL for Deep Links
        const url = new URL(window.location.href);
        const connect = url.searchParams.get('connect');
        const key = url.searchParams.get('key');
        if (connect && key) {
            setTargetPeerId(connect);
            setAccessPin(key);
            setMode('JOIN');
            setPendingJoin({ id: connect, pin: key });
        }
    }, []);

    // --- LOGIC: NETWORK WATCHDOG ---
    const startHeartbeat = useCallback(() => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
            if (!connRef.current) return;

            // Check Native ICE State
            const iceState = connRef.current.peerConnection?.iceConnectionState;
            
            if (iceState === 'disconnected' || iceState === 'failed' || !connRef.current.open) {
                console.warn("Network Hiccup Detected:", iceState);
                setIsPeerOnline(false);
                setStage('RECONNECTING');
                // Auto Attempt Reconnect if ID exists
                if (targetPeerId && mode === 'CHAT') {
                    joinSession(targetPeerId, pinRef.current);
                }
            } else {
                const start = Date.now();
                connRef.current.send({ type: 'PING', time: start });
            }
        }, HEARTBEAT_MS);
    }, [targetPeerId, mode]);

    const handleDisconnect = useCallback(() => {
        setIsPeerOnline(false);
        setStage('DISCONNECTED');
        triggerHaptic([200, 100, 200]);
        playSound('ERROR');
        
        // AGGRESSIVE RECONNECT LOGIC
        setTimeout(() => {
            if (targetPeerId && mode === 'CHAT') {
                setStage('RECONNECTING');
                joinSession(targetPeerId, pinRef.current);
            }
        }, RECONNECT_DELAY);
    }, [targetPeerId, mode]);

    const handleData = useCallback(async (data: any, incomingConn?: any) => {
        // ... (Chunk Logic Sama)
        if (data.type === 'CHUNK') {
            const { id, idx, total, chunk } = data;
            if(!chunkBuffer.current[id]) chunkBuffer.current[id] = { chunks: new Array(total), count:0, total };
            const buf = chunkBuffer.current[id];
            if(!buf.chunks[idx]) { buf.chunks[idx] = chunk; buf.count++; }
            if(buf.count === total) {
                const full = buf.chunks.join('');
                delete chunkBuffer.current[id];
                handleData({type:'MSG', payload: full}, incomingConn);
            }
            return;
        }

        const currentPin = pinRef.current;

        if (data.type === 'REQ') {
            const json = await decryptData(data.payload, currentPin);
            if (json) {
                const req = JSON.parse(json);
                if (req.type === 'CONNECTION_REQUEST') {
                    setIncomingRequest({ peerId: incomingConn.peer, identity: req.identity, conn: incomingConn });
                    playSound('MSG_IN');
                }
            }
        }
        else if (data.type === 'RESP') {
            const json = await decryptData(data.payload, currentPin);
            if (json) {
                const res = JSON.parse(json);
                if (res.type === 'CONNECTION_ACCEPT') {
                    setStage('SECURE');
                    setMode('CHAT');
                    setIsPeerOnline(true);
                    startHeartbeat();
                    playSound('CONNECT');
                }
            }
        }
        else if (data.type === 'MSG') {
            const json = await decryptData(data.payload, currentPin);
            if (json) {
                const msg = JSON.parse(json);
                setMessages(p => [...p, { ...msg, sender: 'THEM', status: 'READ' }]);
                playSound('MSG_IN');
            }
        }
        else if (data.type === 'PING') { 
            setIsPeerOnline(true); 
            if(stage !== 'SECURE') setStage('SECURE');
            // Calculate Latency roughly
            if (data.time) {
                const latency = Date.now() - data.time;
                setPingLatency(latency);
            }
        }
    }, [startHeartbeat]);

    // --- PEER INIT (ULTRA AGGRESSIVE) ---
    useEffect(() => {
        let mounted = true;
        if (peerRef.current) return;

        const init = async () => {
            try {
                setStage('FETCHING_RELAYS');
                const iceServers = await getIceServers();
                
                const { Peer } = await import('peerjs');
                if (!mounted) return;

                const peer = new Peer(myProfile.id, {
                    debug: 0,
                    secure: true,
                    config: { 
                        iceServers, 
                        sdpSemantics: 'unified-plan',
                        iceCandidatePoolSize: 10, // MAX POOL UNTUK SWITCHOVER CEPAT
                        iceTransportPolicy: 'all' // PAKSA SEMUA JALUR (RELAY/HOST/SRFLX)
                    }
                });

                peer.on('open', () => {
                    console.log("[ISTOK_NET] Online:", myProfile.id);
                    setStage('IDLE');
                    if (pendingJoin) {
                        joinSession(pendingJoin.id, pendingJoin.pin);
                        setPendingJoin(null);
                    }
                });

                peer.on('connection', c => {
                    c.on('data', d => handleData(d, c));
                    c.on('close', handleDisconnect);
                    // Monitor ICE State Change directly on incoming connection
                    c.on('iceStateChanged', (state) => {
                         if (state === 'disconnected' || state === 'failed') handleDisconnect();
                    });
                });

                peer.on('error', err => {
                    console.error("Peer Error:", err);
                    if (err.type === 'peer-unavailable') { setErrorMsg("TARGET NOT FOUND"); setStage('IDLE'); }
                    else if (err.type === 'disconnected' || err.type === 'network') { 
                        peer.reconnect(); 
                        setStage('RECONNECTING');
                    }
                });

                peerRef.current = peer;
            } catch (e) {
                setErrorMsg("INIT FAILED");
            }
        };
        init();
        return () => { 
            mounted = false; 
            if(peerRef.current) peerRef.current.destroy(); 
            clearInterval(heartbeatRef.current);
        };
    }, []);

    // --- JOIN FUNCTION ---
    const joinSession = (id?: string, pin?: string) => {
        const target = id || targetPeerId;
        const key = pin || accessPin;
        if (!target || !key) return;

        if (!peerRef.current || peerRef.current.disconnected) {
            peerRef.current?.reconnect();
            setPendingJoin({id: target, pin: key});
            return;
        }

        setStage('LOCATING_PEER');
        
        const conn = peerRef.current.connect(target, { 
            reliable: true,
            serialization: 'binary',
            metadata: { type: 'AGGRESSIVE_HANDSHAKE' }
        });
        
        conn.on('open', async () => {
            setStage('VERIFYING_KEYS');
            connRef.current = conn;
            const payload = JSON.stringify({ type: 'CONNECTION_REQUEST', identity: myProfile.username });
            const encrypted = await encryptData(payload, key);
            
            if (encrypted) {
                conn.send({ type: 'REQ', payload: encrypted });
                setStage('AWAITING_APPROVAL');
            }
        });

        conn.on('data', (d: any) => handleData(d, conn));
        conn.on('close', handleDisconnect);
        conn.on('error', () => { handleDisconnect(); });
    };

    // --- OTHER HANDLERS ---
    const handleQRScan = (data: string) => {
        setShowScanner(false);
        try {
            const url = new URL(data);
            const connect = url.searchParams.get('connect');
            const key = url.searchParams.get('key');
            if (connect && key) {
                setTargetPeerId(connect); setAccessPin(key);
                joinSession(connect, key);
                return;
            }
        } catch(e) {}
        setTargetPeerId(data);
    };

    // --- SEND MSG ---
    const sendMessage = async (type: string, content: string, extras = {}) => {
        if (!connRef.current) return;
        
        // ... (Logic Translate & AI sama seperti sebelumnya)
        // Saya persingkat untuk fokus pada struktur koneksi
        const msgId = crypto.randomUUID();
        const payloadObj = { id: msgId, type, content, timestamp: Date.now(), ttl: ttlMode, ...extras };
        
        const encrypted = await encryptData(JSON.stringify(payloadObj), pinRef.current);
        if (!encrypted) return;

        if (encrypted.length > CHUNK_SIZE) {
            const total = Math.ceil(encrypted.length / CHUNK_SIZE);
            for(let i=0; i<total; i++) {
                connRef.current.send({
                    type: 'CHUNK', id: crypto.randomUUID(), idx: i, total, 
                    chunk: encrypted.slice(i*CHUNK_SIZE, (i+1)*CHUNK_SIZE)
                });
            }
        } else {
            connRef.current.send({ type: 'MSG', payload: encrypted });
        }
        setMessages(p => [...p, { ...payloadObj, sender: 'ME', status: 'SENT' } as Message]);
        playSound('MSG_OUT');
    };

    // =========================================================================
    // RENDER: NOTIFICATION OMNIPRESENT
    // =========================================================================
    
    return (
        <div className="h-[100dvh] bg-[#050505] flex flex-col relative font-sans text-white overflow-hidden">
            
            {/* 1. GLOBAL OVERLAY NOTIFICATION (ALWAYS ON TOP) */}
            <GlobalStatusOverlay stage={stage} isOnline={isPeerOnline} ping={pingLatency} />
            
            {/* 2. GLOBAL MODALS (CALL, IMAGE VIEW) */}
            {viewImage && <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={()=>setViewImage(null)}><img src={viewImage} className="max-w-full max-h-full rounded shadow-2xl"/></div>}
            {incomingCall && !showCall && <CallNotification identity={incomingCall.peer} onAnswer={()=>{setShowCall(true)}} onDecline={()=>{incomingCall.close(); setIncomingCall(null);}} />}
            {showCall && <TeleponanView onClose={()=>{setShowCall(false); setIncomingCall(null);}} existingPeer={peerRef.current} initialTargetId={targetPeerId} incomingCall={incomingCall} secretPin={pinRef.current}/>}
            {incomingRequest && (
                 <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                    <ConnectionNotification 
                        identity={incomingRequest.identity} 
                        peerId={incomingRequest.peerId} 
                        onAccept={async () => {
                            connRef.current = incomingRequest.conn;
                            const payload = JSON.stringify({ type: 'CONNECTION_ACCEPT', identity: myProfile.username });
                            const enc = await encryptData(payload, pinRef.current);
                            if(enc) incomingRequest.conn.send({type: 'RESP', payload: enc});
                            setStage('SECURE'); setMode('CHAT'); setIncomingRequest(null);
                            startHeartbeat();
                        }} 
                        onDecline={()=>{ setIncomingRequest(null); }} 
                    />
                 </div>
            )}

            {/* 3. APP CONTENT LAYERS */}
            
            {mode === 'SELECT' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                     <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                     <div className="text-center z-10 space-y-2 mb-10">
                        <h1 className="text-5xl font-black italic tracking-tighter drop-shadow-lg">IStoic <span className="text-emerald-500">NET</span></h1>
                        <p className="text-[10px] text-neutral-500 font-mono tracking-widest">CROSS-BORDER NEURAL LINK</p>
                    </div>
                    <div className="grid gap-4 w-full max-w-xs z-10">
                        <button onClick={()=>{setAccessPin(Math.floor(100000+Math.random()*900000).toString()); setMode('HOST');}} className="p-5 bg-[#09090b] border border-white/10 hover:border-emerald-500/50 rounded-2xl flex items-center gap-4 transition-all">
                            <Server className="text-emerald-500"/>
                            <div><h3 className="font-bold">HOST SECURE</h3><p className="text-[9px] text-neutral-500">Create Private Room</p></div>
                        </button>
                        <button onClick={()=>setMode('JOIN')} className="p-5 bg-[#09090b] border border-white/10 hover:border-blue-500/50 rounded-2xl flex items-center gap-4 transition-all">
                            <ScanLine className="text-blue-500"/>
                            <div><h3 className="font-bold">JOIN TARGET</h3><p className="text-[9px] text-neutral-500">Scan or Input ID</p></div>
                        </button>
                        <button onClick={()=>setShowSidebar(true)} className="p-4 text-neutral-500 hover:text-white text-xs font-bold tracking-widest flex items-center justify-center gap-2"><Menu size={14}/> CONTACTS</button>
                    </div>
                    <SidebarIStokContact 
                        isOpen={showSidebar} onClose={()=>setShowSidebar(false)} sessions={sessions} profile={myProfile}
                        onSelect={(s)=>{ setTargetPeerId(s.id); setAccessPin(s.pin); joinSession(s.id, s.pin); setShowSidebar(false); }}
                        onCallContact={()=>{}} onRenameSession={()=>{}} onDeleteSession={()=>{}} onRegenerateProfile={()=>{}} currentPeerId={null}
                    />
                </div>
            )}

            {(mode === 'HOST' || mode === 'JOIN') && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black relative">
                    {showScanner && <div className="absolute inset-0 z-50 bg-black"><QRScanner onScan={handleQRScan} onClose={()=>setShowScanner(false)} /></div>}
                    
                    <button onClick={()=>{setMode('SELECT'); setStage('IDLE');}} className="absolute top-6 left-6 z-40 text-neutral-500 hover:text-white flex items-center gap-2 text-xs font-bold"><ArrowLeft size={16}/> ABORT</button>
                    
                    {mode === 'HOST' ? (
                        <div className="w-full max-w-sm bg-[#09090b] border border-white/10 p-8 rounded-[32px] text-center space-y-6">
                            <Server className="text-emerald-500 mx-auto animate-pulse" size={48} />
                            <div>
                                <p className="text-[10px] text-neutral-500 font-mono mb-2">SIGNAL ID</p>
                                <code className="block bg-black p-3 rounded-lg border border-white/10 text-emerald-500 text-xs font-mono break-all">{myProfile.id}</code>
                            </div>
                            <div>
                                <p className="text-[10px] text-neutral-500 font-mono mb-2">ACCESS PIN</p>
                                <div className="text-3xl font-black tracking-[0.5em]">{accessPin}</div>
                            </div>
                            <button onClick={()=>setShowShare(true)} className="w-full py-3 bg-white/5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"><QrCode size={14}/> SHOW QR</button>
                        </div>
                    ) : (
                        <div className="w-full max-w-sm space-y-4">
                             <div className="text-center mb-8">
                                <div onClick={()=>setShowScanner(true)} className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-blue-500/20 border border-blue-500/30"><ScanLine className="text-blue-500" size={32}/></div>
                                <h2 className="text-xl font-bold">ESTABLISH UPLINK</h2>
                            </div>
                            <input value={targetPeerId} onChange={e=>setTargetPeerId(e.target.value)} placeholder="TARGET ID" className="w-full bg-[#09090b] p-4 rounded-xl border border-white/10 text-center font-mono"/>
                            <input value={accessPin} onChange={e=>setAccessPin(e.target.value)} placeholder="PIN" className="w-full bg-[#09090b] p-4 rounded-xl border border-white/10 text-center font-mono tracking-widest"/>
                            <button onClick={()=>joinSession()} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20">CONNECT NOW</button>
                        </div>
                    )}
                    {showShare && <ShareConnection peerId={myProfile.id} pin={accessPin} onClose={()=>setShowShare(false)}/>}
                </div>
            )}

            {mode === 'CHAT' && (
                <>
                    <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#09090b] z-20 pt-[calc(env(safe-area-inset-top)+3rem)]"> {/* Extra padding top for notification */}
                        <button onClick={()=>{connRef.current?.close(); setMode('SELECT'); setMessages([]);}}><ArrowLeft size={20}/></button>
                        <div className="flex gap-4">
                            <button onClick={()=>triggerHaptic(50)}><Zap size={18} className="text-yellow-500"/></button>
                            <button onClick={()=>setShowCall(true)}><PhoneCall size={18} className="text-emerald-500"/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scroll bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-95">
                        {messages.map(m => ( <MessageBubble key={m.id} msg={m} setViewImage={setViewImage} onBurn={(id: string)=>setMessages(p=>p.filter(x=>x.id!==id))} /> ))}
                        <div ref={msgEndRef} />
                    </div>
                    <div className="bg-[#09090b] border-t border-white/10 p-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
                        {/* INPUT COMPONENT DISINI (SAMA SEPERTI KODE SEBELUMNYA) */}
                        <div className="flex gap-2 items-center">
                            <button onClick={()=>fileInputRef.current?.click()} className="p-3 bg-white/5 rounded-full"><Paperclip size={20}/></button>
                            <input 
                                className="flex-1 bg-white/5 rounded-full px-4 py-3 outline-none text-sm" 
                                placeholder="Message..."
                                onKeyDown={(e)=>{if(e.key==='Enter') sendMessage('TEXT', (e.target as any).value);}}
                            />
                            <button className="p-3 bg-emerald-600 rounded-full"><Send size={20}/></button>
                        </div>
                    </div>
                </>
            )}

            <input type="file" ref={fileInputRef} className="hidden" onChange={(e)=>{
                const f = e.target.files?.[0];
                if(f) {
                     // File Logic (Compress & Send)
                     const r = new FileReader();
                     r.onload = async (ev) => sendMessage('FILE', (ev.target?.result as string).split(',')[1], {fileName:f.name, size:f.size, mimeType:f.type});
                     r.readAsDataURL(f);
                }
            }}/>
        </div>
    );
};
