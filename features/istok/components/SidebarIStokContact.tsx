import React, { useState, useMemo } from 'react';
import { 
    X, User, Trash2, Activity, Search, ArrowRight,
    Wifi, RefreshCw, Users, UserPlus, MessageSquare,
    Save, Copy, Check, ShieldCheck, Zap
} from 'lucide-react';
import useLocalStorage from '../../../hooks/useLocalStorage';

// --- TYPES ---
export interface IStokContact {
    id: string;      // ID Peer (Unik)
    name: string;    // Nama Alias
    addedAt: number;
    trustLevel: 'VERIFIED' | 'UNKNOWN';
}

export interface IStokSession {
    id: string; 
    name: string; 
    customName?: string;
    lastSeen: number;
    status: 'ONLINE' | 'BACKGROUND' | 'OFFLINE';
    pin: string;
    createdAt: number;
    isContact?: boolean;
}

export interface IStokProfile {
    id: string;
    username: string;
    created: number;
}

interface SidebarIStokContactProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: IStokSession[];
    profile: IStokProfile;
    onSelect: (session: IStokSession) => void;
    onCallContact: (contact: IStokContact) => void;
    onRenameSession: (id: string, newName: string) => void;
    onDeleteSession: (id: string) => void;
    onRegenerateProfile: () => void;
    currentPeerId: string | null;
}

// --- UTILS ---
const formatRelativeTime = (timestamp: number) => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes}m lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}j lalu`;
    return new Date(timestamp).toLocaleDateString();
};

export const SidebarIStokContact: React.FC<SidebarIStokContactProps> = ({
    isOpen,
    onClose,
    sessions = [], 
    profile,
    onSelect,
    onCallContact,
    onDeleteSession,
    onRegenerateProfile,
    currentPeerId
}) => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'CHATS' | 'CONTACTS'>('CHATS');
    const [contacts, setContacts] = useLocalStorage<IStokContact[]>('istok_saved_contacts', []);
    const [search, setSearch] = useState('');
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [newContactId, setNewContactId] = useState('');
    const [newContactName, setNewContactName] = useState('');
    const [copied, setCopied] = useState(false);

    // --- LOGIC ---

    const handleAddContact = () => {
        if (!newContactId || !newContactName) return;
        // Cek duplikat
        if (contacts && contacts.some(c => c && c.id === newContactId)) {
            alert("Kontak sudah ada!"); 
            return;
        }
        
        const newContact: IStokContact = {
            id: newContactId.trim(),
            name: newContactName.trim(),
            addedAt: Date.now(),
            trustLevel: 'UNKNOWN'
        };
        
        setContacts(prev => [...(prev || []), newContact]);
        setIsAddingContact(false);
        setNewContactId(''); setNewContactName('');
        setActiveTab('CONTACTS');
    };

    const handleDeleteContact = (id: string) => {
        if (confirm("Hapus kontak ini secara permanen?")) {
            setContacts(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleCopyId = () => {
        if (profile?.id) {
            navigator.clipboard.writeText(profile.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Filter & Merge Data (POWERFUL & SAFE)
    const mergedSessions = useMemo(() => {
        if (!Array.isArray(sessions)) return [];
        return sessions
            .filter(s => s && s.id) // SAFETY FIRST: Buang data corrupt
            .map(s => {
                const contact = Array.isArray(contacts) ? contacts.find(c => c && c.id === s.id) : undefined;
                return { 
                    ...s, 
                    displayName: contact ? contact.name : (s.customName || s.name || 'Unknown User'),
                    isContact: !!contact 
                };
            })
            .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    }, [sessions, contacts]);

    const filteredSessions = mergedSessions.filter(s => 
        (s.displayName || '').toLowerCase().includes(search.toLowerCase())
    );
    
    const filteredContacts = Array.isArray(contacts) ? contacts.filter(c => 
        c && ((c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.id || '').includes(search))
    ) : [];

    // --- RENDER ---
    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={onClose} 
            />

            {/* Sidebar Panel */}
            <div className={`
                fixed inset-y-0 right-0 w-full max-w-xs bg-[#09090b] border-l border-white/10 z-[2010] 
                flex flex-col transform transition-transform duration-300 shadow-2xl font-sans
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                
                {/* 1. Header Profile */}
                <div className="p-5 border-b border-white/10 bg-[#050505] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                            <Zap size={14} className="text-emerald-500 fill-current"/> ISTOK_NET
                        </h2>
                        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition"><X size={18} className="text-neutral-500 hover:text-white" /></button>
                    </div>

                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 backdrop-blur-md relative group">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">MY SECURE ID</p>
                            <button onClick={handleCopyId} className="text-neutral-500 hover:text-emerald-400 transition">
                                {copied ? <Check size={12}/> : <Copy size={12}/>}
                            </button>
                        </div>
                        <code 
                            onClick={handleCopyId}
                            className="text-xs font-mono text-emerald-400 block cursor-pointer select-all truncate hover:opacity-80 transition"
                        >
                            {profile?.id || 'GENERATING...'}
                        </code>
                        <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={onRegenerateProfile} className="p-1.5 bg-black/50 rounded-tl-lg text-neutral-400 hover:text-white" title="Ganti Identity"><RefreshCw size={10}/></button>
                        </div>
                    </div>
                </div>

                {/* 2. Controls & Search */}
                <div className="px-4 py-3 space-y-3 bg-[#09090b]">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                        <button 
                            onClick={() => setActiveTab('CHATS')} 
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'CHATS' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-neutral-500 hover:text-white'}`}
                        >
                            <MessageSquare size={12}/> CHATS
                        </button>
                        <button 
                            onClick={() => setActiveTab('CONTACTS')} 
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'CONTACTS' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-neutral-500 hover:text-white'}`}
                        >
                            <Users size={12}/> KONTAK
                        </button>
                    </div>
                    
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-emerald-500 transition-colors" size={14} />
                        <input 
                            type="text" 
                            value={search} 
                            onChange={(e)=>setSearch(e.target.value)} 
                            placeholder={activeTab === 'CHATS' ? "Cari riwayat..." : "Cari teman..."}
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-neutral-700 outline-none focus:border-emerald-500/50 transition-all font-mono"
                        />
                    </div>
                </div>

                {/* 3. Main List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scroll">
                    
                    {/* --- CHATS TAB --- */}
                    {activeTab === 'CHATS' && (
                        <>
                            {filteredSessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 opacity-30 text-neutral-500 space-y-2">
                                    <MessageSquare size={32} strokeWidth={1}/>
                                    <p className="text-[10px] font-bold tracking-widest">NO ACTIVE CHATS</p>
                                </div>
                            ) : (
                                filteredSessions.map(s => {
                                    const isConnected = currentPeerId === s.id;
                                    return (
                                        <div 
                                            key={s.id} 
                                            onClick={() => onSelect(s)} 
                                            className={`
                                                group relative p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3
                                                ${isConnected 
                                                    ? 'bg-emerald-900/10 border-emerald-500/30' 
                                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}
                                            `}
                                        >
                                            <div className="relative">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner ${s.isContact ? 'bg-indigo-600' : 'bg-neutral-700'}`}>
                                                    {(s.displayName || '?').substring(0, 2).toUpperCase()}
                                                </div>
                                                {s.status === 'ONLINE' && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#09090b]"></div>}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <h4 className={`text-xs font-bold truncate ${isConnected ? 'text-emerald-400' : 'text-white'}`}>
                                                        {s.displayName}
                                                    </h4>
                                                    <span className="text-[8px] font-mono text-neutral-600">{formatRelativeTime(s.lastSeen)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {s.isContact && <ShieldCheck size={10} className="text-indigo-400"/>}
                                                    <p className="text-[9px] text-neutral-500 truncate font-mono">
                                                        {isConnected ? 'ENCRYPTED_TUNNEL_ACTIVE' : s.id.substring(0, 12) + '...'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Quick Actions on Hover */}
                                            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-[#09090b]/80 backdrop-blur rounded-lg p-1">
                                                {!s.isContact && (
                                                    <button 
                                                        onClick={(e)=>{e.stopPropagation(); setNewContactId(s.id); setNewContactName(s.displayName); setIsAddingContact(true);}}
                                                        className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500 hover:text-white"
                                                    >
                                                        <UserPlus size={14}/>
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={(e)=>{e.stopPropagation(); onDeleteSession(s.id);}} 
                                                    className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500 hover:text-white"
                                                >
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}

                    {/* --- CONTACTS TAB --- */}
                    {activeTab === 'CONTACTS' && (
                        <>
                            {!isAddingContact ? (
                                <button 
                                    onClick={()=>setIsAddingContact(true)} 
                                    className="w-full py-3 border border-dashed border-white/10 bg-white/5 rounded-xl text-neutral-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-4"
                                >
                                    <UserPlus size={14}/> ADD NEW CONTACT
                                </button>
                            ) : (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-4 animate-slide-up">
                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2"><UserPlus size={12}/> NEW ENTRY</h4>
                                    <div className="space-y-2">
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-neutral-500 font-bold ml-1">DISPLAY NAME</label>
                                            <input 
                                                value={newContactName} 
                                                onChange={e=>setNewContactName(e.target.value)} 
                                                className="w-full bg-black border border-white/10 p-2.5 rounded-lg text-xs text-white focus:border-emerald-500 outline-none"
                                                placeholder="e.g. Agent Smith"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-neutral-500 font-bold ml-1">PEER ID</label>
                                            <input 
                                                value={newContactId} 
                                                onChange={e=>setNewContactId(e.target.value)} 
                                                className="w-full bg-black border border-white/10 p-2.5 rounded-lg text-xs text-emerald-500 font-mono focus:border-emerald-500 outline-none"
                                                placeholder="ISTOK-..."
                                            />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={()=>setIsAddingContact(false)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-neutral-400">CANCEL</button>
                                            <button onClick={handleAddContact} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-bold text-white shadow-lg flex items-center justify-center gap-2"><Save size={12}/> SAVE</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {filteredContacts.length === 0 && !isAddingContact ? (
                                <div className="flex flex-col items-center justify-center h-40 opacity-30 text-neutral-500 space-y-2">
                                    <Users size={32} strokeWidth={1}/>
                                    <p className="text-[10px] font-bold tracking-widest">NO SAVED CONTACTS</p>
                                </div>
                            ) : (
                                filteredContacts.map(c => (
                                    <div 
                                        key={c.id} 
                                        className="group p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all flex items-center gap-3 cursor-pointer"
                                        onClick={()=>onCallContact(c)}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-900 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-lg">
                                            {(c.name || '?').substring(0,2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                                            <p className="text-[9px] text-neutral-500 truncate font-mono">{c.id.substring(0, 16)}...</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e)=>{e.stopPropagation(); onCallContact(c);}} 
                                                className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white"
                                            >
                                                <ArrowRight size={14}/>
                                            </button>
                                            <button 
                                                onClick={(e)=>{e.stopPropagation(); handleDeleteContact(c.id);}} 
                                                className="p-2 bg-white/5 text-neutral-400 rounded-lg hover:bg-red-500 hover:text-white"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};