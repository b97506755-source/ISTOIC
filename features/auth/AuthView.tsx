
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Loader2, Fingerprint, Lock, ShieldAlert, ScanFace, Chrome, UserPlus, KeyRound, CheckCircle2, RefreshCw, LogIn, Mail, HelpCircle, Terminal } from 'lucide-react';
import { verifySystemPin, verifyMasterPin, isSystemPinConfigured, setSystemPin } from '../../utils/crypto';
import { BiometricService } from '../../services/biometricService';
import useLocalStorage from '../../hooks/useLocalStorage';
import { IstokIdentityService, IStokUserIdentity } from '../istok/services/istokIdentity';
import { RegisterManual, ForgotPin, ForgotAccount } from './ManualAuth';

// Import Firebase directly for silent check
import { auth, db } from '../../services/firebaseConfig';
// @ts-ignore
import { onAuthStateChanged } from 'firebase/auth';
// @ts-ignore
import { doc, getDoc } from 'firebase/firestore';

interface AuthViewProps {
    onAuthSuccess: () => void;
}

// Updated Auth Stages
type AuthStage = 'CHECKING' | 'WELCOME' | 'CREATE_ID' | 'SETUP_PIN' | 'LOCKED' | 'BIOMETRIC_SCAN' | 'REGISTER_MANUAL' | 'FORGOT_PIN' | 'FORGOT_ACCOUNT';

// SECURITY CONSTANTS
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 Minutes

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
    // --- GLOBAL STATE ---
    const [identity, setIdentity] = useLocalStorage<IStokUserIdentity | null>('istok_user_identity', null);
    const [isPinSet, setIsPinSet] = useState(isSystemPinConfigured());
    const [bioEnabled, setBioEnabled] = useLocalStorage<boolean>('bio_auth_enabled', false);
    
    // --- SECURITY PERSISTENCE ---
    const [failedAttempts, setFailedAttempts] = useLocalStorage<number>('auth_failed_count', 0);
    const [lockoutUntil, setLockoutUntil] = useLocalStorage<number>('auth_lockout_until', 0);

    // --- UI STATE ---
    const [stage, setStage] = useState<AuthStage>('CHECKING');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shake, setShake] = useState(false);
    const [bioStatus, setBioStatus] = useState("SCANNING...");

    // --- INPUTS ---
    const [codename, setCodename] = useState('');
    const [pinInput, setPinInput] = useState('');
    
    // --- LOCKOUT LOGIC ---
    const [isHardLocked, setIsHardLocked] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);

    // --- SECURITY CHECK ON MOUNT ---
    useEffect(() => {
        const checkLockout = () => {
            const now = Date.now();
            if (lockoutUntil > now) {
                setIsHardLocked(true);
                setCountdown(Math.ceil((lockoutUntil - now) / 1000));
            } else {
                if (isHardLocked) {
                    setIsHardLocked(false);
                    setFailedAttempts(0);
                    setLockoutUntil(0);
                }
            }
        };

        checkLockout();
        const interval = setInterval(checkLockout, 1000);
        return () => clearInterval(interval);
    }, [lockoutUntil, isHardLocked]);

    // --- SMART AUTO FLOW ---
    useEffect(() => {
        let unsubscribe: any;

        const initFlow = async () => {
            // 1. FAST PATH: Identity already in Storage
            if (identity && identity.istokId) {
                if (isSystemPinConfigured()) {
                    if (bioEnabled && !isHardLocked) {
                        setStage('BIOMETRIC_SCAN');
                        handleBiometricScan();
                    } else {
                        setStage('LOCKED');
                    }
                } else {
                    setStage('SETUP_PIN');
                }
                return;
            }

            // 2. SLOW PATH: Check Firebase Auth (Silent Restore)
            if (auth) {
                unsubscribe = onAuthStateChanged(auth, async (user: any) => {
                    if (user) {
                        try {
                            const snap = await getDoc(doc(db, "users", user.uid));
                            if (snap.exists()) {
                                const data = snap.data() as IStokUserIdentity;
                                setIdentity(data);
                            } else {
                                setStage('CREATE_ID');
                                (window as any).tempGoogleUser = {
                                    uid: user.uid,
                                    email: user.email,
                                    displayName: user.displayName || user.email.split('@')[0],
                                    photoURL: user.photoURL
                                };
                            }
                        } catch (e) {
                            console.error("Silent Restore Failed", e);
                            setStage('WELCOME');
                        }
                    } else {
                        setStage('WELCOME');
                    }
                });
            } else {
                setStage('WELCOME');
            }
        };

        initFlow();
        return () => { if (unsubscribe) unsubscribe(); }
    }, [identity]); 

    // Focus Helper
    useEffect(() => {
        if (stage === 'LOCKED' && !isHardLocked && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [stage, isHardLocked]);

    // --- BIOMETRIC HANDLER ---
    const handleBiometricScan = async () => {
        if (isHardLocked) return;
        
        setBioStatus("SCANNING FACE ID...");
        try {
            const success = await BiometricService.authenticate();
            if (success) {
                setBioStatus("AUTHORIZED");
                setFailedAttempts(0); // Reset on success
                setTimeout(onAuthSuccess, 500); 
            } else {
                setBioStatus("FAILED");
                setTimeout(() => setStage('LOCKED'), 800); 
            }
        } catch (e) {
            setBioStatus("ERROR");
            setTimeout(() => setStage('LOCKED'), 800);
        }
    };

    // --- GOOGLE LOGIN ---
    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const userProfile = await IstokIdentityService.loginWithGoogle();
            
            if (userProfile) {
                if (userProfile.istokId) {
                    setIdentity(userProfile);
                } else {
                    setStage('CREATE_ID');
                    (window as any).tempGoogleUser = userProfile;
                }
            }
        } catch (err: any) {
            setError(err.message || "Login Failed");
            setShake(true); 
            setTimeout(() => setShake(false), 500);
        } finally {
            setLoading(false);
        }
    };

    // --- CREATE ID ---
    const handleCreateIdentity = async () => {
        if (codename.length < 3) {
            setError("MINIMUM 3 CHARS");
            setShake(true); setTimeout(() => setShake(false), 500);
            return;
        }

        const googleUser = (window as any).tempGoogleUser;
        const finalId = IstokIdentityService.formatId(codename);
        
        const newIdentity: IStokUserIdentity = {
            ...googleUser,
            codename: codename.toUpperCase(),
            istokId: finalId
        };

        setLoading(true);
        try {
            await IstokIdentityService.createProfile(newIdentity);
            setIdentity(newIdentity);
            setStage('SETUP_PIN');
        } catch (err: any) {
            setError(err.message || "Failed to create profile");
        } finally {
            setLoading(false);
        }
    };

    // --- SETUP PIN ---
    const handleSetupPin = async () => {
        if (pinInput.length < 4) {
            setError("PIN MIN 4 DIGITS"); return;
        }
        
        await setSystemPin(pinInput);
        setIsPinSet(true);
        
        if (await BiometricService.isAvailable()) {
             if (confirm("Aktifkan Face ID / Fingerprint untuk akses cepat?")) {
                 try {
                     const res = await BiometricService.register(identity?.codename || 'User');
                     if (res) setBioEnabled(true);
                 } catch (e) { console.error(e); }
             }
        }
        
        onAuthSuccess();
    };

    // --- UNLOCK (With Developer Master Key Bypass) ---
    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isHardLocked) return;
        
        setLoading(true);
        
        // Artificial delay for security feel & brute force prevention
        await new Promise(r => setTimeout(r, 600));

        // 1. CHECK MASTER KEY (DEVELOPER BYPASS)
        const isMaster = await verifyMasterPin(pinInput);
        if (isMaster) {
            // Inject Developer Identity if none exists or override existing
            const devIdentity: IStokUserIdentity = {
                uid: 'DEV-ROOT-ACCESS',
                istokId: 'ISTOIC-DEV',
                codename: 'DEVELOPER',
                email: 'dev@system.local',
                displayName: 'SYSTEM ADMIN',
                photoURL: 'https://ui-avatars.com/api/?name=Dev&background=10b981&color=fff'
            };
            
            if (!identity || !identity.istokId) {
                 setIdentity(devIdentity);
            }
            
            // Reset counters
            setFailedAttempts(0);
            onAuthSuccess();
            setLoading(false);
            return;
        }
        
        // 2. CHECK USER PIN
        const isValid = await verifySystemPin(pinInput);
        if (isValid) {
            setFailedAttempts(0);
            onAuthSuccess();
        } else {
            const newCount = failedAttempts + 1;
            setFailedAttempts(newCount);
            setPinInput('');
            setShake(true); setTimeout(() => setShake(false), 500);
            
            if (newCount >= MAX_ATTEMPTS) {
                // Trigger Hard Lockout
                setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
                setIsHardLocked(true);
                setError(`SYSTEM LOCKED FOR ${LOCKOUT_DURATION_MS/60000} MINS`);
            } else {
                setError(`INVALID PASSCODE (${MAX_ATTEMPTS - newCount} attempts left)`);
            }
        }
        setLoading(false);
    };

    // --- RENDERERS ---

    if (stage === 'CHECKING') {
        return (
            <div className="fixed inset-0 bg-[#020202] flex items-center justify-center">
                 <div className="flex flex-col items-center gap-4">
                     <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                     <p className="text-emerald-500 text-[10px] font-black tracking-[0.3em] animate-pulse">RESTORING IDENTITY...</p>
                 </div>
            </div>
        );
    }

    if (stage === 'BIOMETRIC_SCAN') {
        return (
            <div className="fixed inset-0 z-[9999] bg-[#000000] flex flex-col items-center justify-center animate-fade-in text-emerald-500">
                <div className="relative mb-8">
                    <ScanFace size={64} strokeWidth={1} className="animate-pulse" />
                    <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-[spin_3s_linear_infinite] w-full h-full scale-150 border-t-emerald-500"></div>
                </div>
                <h2 className="text-xl font-black tracking-widest uppercase">{bioStatus}</h2>
                <button 
                    onClick={() => setStage('LOCKED')} 
                    className="mt-8 text-neutral-500 text-xs font-mono hover:text-white"
                >
                    USE PIN
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-[#020202] flex items-center justify-center p-6 overflow-hidden font-sans select-none">
            {/* Background FX */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className={`relative w-full max-w-sm ${shake ? 'animate-[shake_0.5s_cubic-bezier(.36,.07,.19,.97)_both]' : ''}`}>
                <div className="backdrop-blur-2xl border border-white/10 bg-[#0a0a0b]/80 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
                    
                    {/* 1. WELCOME / LANDING */}
                    {stage === 'WELCOME' && (
                        <div className="text-center space-y-8 animate-slide-up">
                            <div className="space-y-2">
                                <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">
                                    ISTOIC <span className="text-emerald-500">TITANIUM</span>
                                </h1>
                                <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.3em]">
                                    SECURE COGNITIVE OS v101.0
                                </p>
                            </div>

                            <div className="space-y-4">
                                {/* Primary: Continue with Google */}
                                <button 
                                    onClick={handleGoogleLogin}
                                    disabled={loading}
                                    className="w-full py-4 bg-white text-black hover:bg-neutral-200 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)] group"
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin"/> : <Chrome size={18} className="text-blue-500"/>}
                                    LANJUTKAN DENGAN GOOGLE
                                </button>

                                <div className="flex items-center gap-4 px-2">
                                    <div className="h-[1px] bg-white/10 flex-1"></div>
                                    <span className="text-[9px] text-neutral-600 font-black uppercase">ATAU</span>
                                    <div className="h-[1px] bg-white/10 flex-1"></div>
                                </div>

                                {/* Manual Register Button */}
                                <button 
                                    onClick={() => setStage('REGISTER_MANUAL')}
                                    disabled={loading}
                                    className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95"
                                >
                                    <Mail size={18} className="text-emerald-500"/>
                                    DAFTAR DENGAN EMAIL
                                </button>

                                {/* Forgot Account Link */}
                                <button 
                                    onClick={() => setStage('FORGOT_ACCOUNT')}
                                    className="text-[9px] font-bold text-neutral-500 hover:text-white transition-colors flex items-center gap-2 mx-auto pt-2"
                                >
                                    <HelpCircle size={10} /> LUPA AKUN?
                                </button>
                            </div>

                            <div className="space-y-4 pt-2">
                                {/* Always allow going to PIN screen if Developer PIN is set OR system pin exists */}
                                {isSystemPinConfigured() && (
                                    <button 
                                        onClick={() => setStage('LOCKED')}
                                        className="text-[10px] font-bold text-neutral-400 hover:text-emerald-500 transition-colors flex items-center justify-center gap-2 mx-auto"
                                    >
                                        <KeyRound size={12}/> AKSES PERANGKAT / DEVELOPER
                                    </button>
                                )}
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium mt-4">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. REGISTER MANUAL (NEW) */}
                    {stage === 'REGISTER_MANUAL' && (
                        <RegisterManual 
                            onBack={() => setStage('WELCOME')}
                            onSuccess={() => setStage('CREATE_ID')} 
                        />
                    )}

                    {/* 3. FORGOT PIN (NEW) */}
                    {stage === 'FORGOT_PIN' && (
                        <ForgotPin 
                            onBack={() => setStage('LOCKED')}
                            onSuccess={() => { setStage('LOCKED'); setIsPinSet(true); setFailedAttempts(0); }}
                        />
                    )}

                    {/* 4. FORGOT ACCOUNT (NEW) */}
                    {stage === 'FORGOT_ACCOUNT' && (
                        <ForgotAccount onBack={() => setStage('WELCOME')} />
                    )}

                    {/* 5. CREATE ID (Only New Users) */}
                    {stage === 'CREATE_ID' && (
                        <div className="space-y-6 animate-slide-up">
                             <div className="text-center">
                                 <h2 className="text-xl font-bold text-white uppercase tracking-tight">Setup Identitas</h2>
                                 <p className="text-xs text-neutral-500 mt-2">Buat Callsign unik untuk jaringan IStok.</p>
                             </div>
                             <div className="bg-[#121214] border border-white/10 rounded-2xl px-4 py-4 focus-within:border-emerald-500 transition-all flex items-center">
                                <span className="text-emerald-500 font-black text-sm mr-1 select-none">ISTOIC-</span>
                                <input 
                                    value={codename}
                                    onChange={e => setCodename(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                                    className="bg-transparent border-none outline-none text-white font-bold text-lg w-full uppercase"
                                    placeholder="BARISTA"
                                    maxLength={12}
                                />
                             </div>
                             {error && (
                                <div className="text-red-500 text-[10px] text-center font-bold">{error}</div>
                             )}
                             <button onClick={handleCreateIdentity} disabled={loading} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="animate-spin"/> : <ArrowRight />} SIMPAN & LANJUT
                             </button>
                        </div>
                    )}

                    {/* 6. SETUP PIN */}
                    {stage === 'SETUP_PIN' && (
                        <div className="space-y-6 animate-slide-up text-center">
                            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 mb-4">
                                <KeyRound size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-white uppercase">Kunci Perangkat</h2>
                            <p className="text-xs text-neutral-500">PIN ini hanya tersimpan di perangkat ini untuk enkripsi lokal. Login berikutnya HANYA menggunakan PIN ini.</p>
                            <input 
                                type="password" inputMode="numeric" value={pinInput}
                                onChange={e => setPinInput(e.target.value.slice(0,6))}
                                className="w-full bg-[#121214] border border-white/10 rounded-2xl py-5 text-center text-3xl font-black text-white tracking-[0.5em] focus:border-amber-500 outline-none"
                                placeholder="••••"
                            />
                            {error && <p className="text-red-500 text-[10px] font-bold">{error}</p>}
                            <button onClick={handleSetupPin} className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest">
                                SET PASSCODE
                            </button>
                        </div>
                    )}

                    {/* 7. LOCKED / PIN ENTRY (Modified for Dev Access) */}
                    {stage === 'LOCKED' && (
                        <form onSubmit={handleUnlock} className="space-y-6 animate-slide-up">
                            <div className="text-center space-y-2 mb-8">
                                <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-4 transition-all duration-500 ${isHardLocked ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/10 text-emerald-500 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]'}`}>
                                    {isHardLocked ? <Lock size={32} /> : (identity ? <Fingerprint size={32} /> : <Terminal size={32} />)}
                                </div>
                                <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                                    {identity?.displayName || 'SYSTEM LOCKED'}
                                </h2>
                                <p className="text-[10px] font-mono text-emerald-500 tracking-wider">
                                    {identity?.istokId || 'AUTH_REQUIRED'}
                                </p>
                            </div>

                            <div className="space-y-4">
                                {isHardLocked ? (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <ShieldAlert size={24} className="text-red-500" />
                                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">SECURITY LOCKOUT</p>
                                        </div>
                                        <p className="text-2xl font-mono text-white font-bold mt-2">00:{Math.floor(countdown / 60).toString().padStart(2,'0')}:{Math.floor(countdown % 60).toString().padStart(2,'0')}</p>
                                    </div>
                                ) : (
                                    <input 
                                        ref={inputRef}
                                        type="password"
                                        inputMode="numeric"
                                        value={pinInput}
                                        onChange={e => { setPinInput(e.target.value.slice(0,6)); setError(null); }}
                                        className={`w-full bg-[#121214] border rounded-2xl py-5 text-center text-3xl font-black text-white tracking-[0.5em] focus:outline-none transition-all placeholder:text-neutral-800 ${error ? 'border-red-500/50' : 'border-white/10 focus:border-emerald-500'}`}
                                        placeholder="••••••"
                                        disabled={loading}
                                        autoComplete="off"
                                    />
                                )}
                                {error && !isHardLocked && <p className="text-center text-[10px] text-red-500 font-bold tracking-widest">{error}</p>}
                            </div>

                            {!isHardLocked && (
                                <div className="space-y-4">
                                    <button 
                                        type="submit"
                                        disabled={loading || pinInput.length < 4}
                                        className="w-full py-4 bg-white text-black hover:bg-neutral-200 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="animate-spin"/> : <ArrowRight />} BUKA
                                    </button>
                                    
                                    {/* RETRY FACE ID BUTTON - Added Requirement */}
                                    {bioEnabled && (
                                        <button 
                                            type="button"
                                            onClick={handleBiometricScan}
                                            className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 border border-emerald-500/30"
                                        >
                                            <ScanFace size={16} /> RETRY FACE ID
                                        </button>
                                    )}

                                    <div className="flex justify-between items-center px-1">
                                        <button 
                                            type="button" 
                                            onClick={() => setStage('FORGOT_PIN')}
                                            className="text-neutral-500 text-[10px] font-bold tracking-widest hover:text-white transition-colors"
                                        >
                                            LUPA PIN?
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setStage('WELCOME')}
                                            className="text-neutral-500 text-[10px] font-bold tracking-widest hover:text-white transition-colors"
                                        >
                                            GANTI AKUN
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    )}

                </div>
            </div>
        </div>
    );
};
