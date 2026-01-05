import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Loader2, Fingerprint, Terminal, AlertTriangle, Lock, ShieldAlert, ScanLine, AlertOctagon, Timer, ScanFace } from 'lucide-react';
import { verifySystemPin, isSystemPinConfigured } from '../../utils/crypto';
import { BiometricService } from '../../services/biometricService';
import useLocalStorage from '../../hooks/useLocalStorage';

interface AuthViewProps {
    onAuthSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passcode, setPasscode] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [shake, setShake] = useState(false);
    
    // Brute Force Protection State
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Biometric State
    const [isBioEnabled] = useLocalStorage<boolean>('bio_auth_enabled', false);
    const [isBioAvailable, setIsBioAvailable] = useState(false);

    const isConfigured = isSystemPinConfigured();

    useEffect(() => {
        if (!isLocked && inputRef.current) inputRef.current.focus();
        
        if (!isConfigured) {
            console.error("⚠️ SECURITY ALERT: No Vault PIN configured (Env or Local). Access will be impossible.");
        }

        // Check hardware support
        BiometricService.isAvailable().then(setIsBioAvailable);
    }, [isConfigured, isLocked]);

    // Auto-trigger biometric if enabled and available
    useEffect(() => {
        if (isBioEnabled && isBioAvailable && !isLocked && !loading) {
            // Slight delay to allow UI render
            // setTimeout(handleBiometricLogin, 500); 
            // Better to let user click to avoid annoyance loops on some browsers
        }
    }, [isBioEnabled, isBioAvailable]);

    // Countdown Timer for Lockout
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (isLocked && countdown > 0) {
            timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);
        } else if (countdown === 0 && isLocked) {
            setIsLocked(false);
            setAttempts(0);
            setError(null);
        }
        return () => clearInterval(timer);
    }, [isLocked, countdown]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passcode || isLocked) return;
        
        setLoading(true);
        setError(null);

        // Artificial delay (Timing Attack Mitigation)
        const delay = Math.floor(Math.random() * 500) + 800; 

        setTimeout(async () => {
            const isValid = await verifySystemPin(passcode);
            
            if (isValid) {
                onAuthSuccess();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                setPasscode('');
                setShake(true);
                setTimeout(() => setShake(false), 500);

                if (newAttempts >= 3) {
                    setIsLocked(true);
                    setCountdown(30); // 30 Seconds Lockout
                    setError("SECURITY_LOCKDOWN: BRUTE_FORCE_DETECTED");
                } else {
                    setError(`ACCESS_DENIED: HASH_MISMATCH (${newAttempts}/3)`);
                }
            }
            setLoading(false);
        }, delay);
    };

    const handleBiometricLogin = async () => {
        if (isLocked) return;
        setLoading(true);
        setError(null);
        
        try {
            const success = await BiometricService.authenticate();
            if (success) {
                onAuthSuccess();
            } else {
                // Don't count bio fails against PIN attempts usually, but we can log it
                setError("BIOMETRIC_MISMATCH");
            }
        } catch (e) {
            setError("BIOMETRIC_ERROR");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-[#020202] flex items-center justify-center p-4 overflow-hidden font-sans select-none">
            {/* Security Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
            
            {/* Ambient Glow */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] ${isLocked ? 'bg-red-900/10' : 'bg-accent/5'} blur-[120px] rounded-full pointer-events-none animate-pulse-slow transition-colors duration-1000`}></div>

            <div className={`relative w-full max-w-sm ${shake ? 'animate-[shake_0.5s_cubic-bezier(.36,.07,.19,.97)_both]' : ''}`}>
                
                {/* Secure Enclave Container */}
                <div className={`
                    backdrop-blur-2xl border rounded-[32px] p-8 shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden group transition-all duration-500
                    ${isLocked 
                        ? 'bg-red-950/20 border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.1)]' 
                        : 'bg-[#0a0a0b]/90 border-white/10 hover:border-accent/30'
                    }
                `}>
                    
                    {/* Header Icon */}
                    <div className="flex justify-center mb-8 relative">
                        <div className={`
                            w-24 h-24 rounded-[32px] flex items-center justify-center relative overflow-hidden transition-all duration-500
                            ${isLocked 
                                ? 'bg-red-500/10 border border-red-500/30' 
                                : 'bg-white/5 border border-white/10 group-hover:shadow-[0_0_30px_var(--accent-glow)]'
                            }
                        `}>
                            <div className={`absolute inset-0 animate-pulse ${isLocked ? 'bg-red-500/10' : 'bg-accent/10'}`}></div>
                            {loading ? (
                                <Loader2 size={40} className="text-accent animate-spin relative z-10" />
                            ) : isLocked ? (
                                <AlertOctagon size={40} className="text-red-500 relative z-10 animate-pulse" strokeWidth={1.5} />
                            ) : (
                                <Fingerprint size={40} className={`text-accent relative z-10 transition-transform duration-500 ${error ? 'text-red-500' : ''}`} strokeWidth={1.5} />
                            )}
                        </div>
                    </div>

                    <div className="text-center mb-8 space-y-2">
                        <h1 className={`text-2xl font-black italic tracking-tighter uppercase leading-none ${isLocked ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                            {isLocked ? 'SYSTEM LOCKDOWN' : <>SYSTEM <span className="text-accent">LOGIN</span></>}
                        </h1>
                        <div className="flex items-center justify-center gap-2 text-neutral-500">
                            <Terminal size={10} />
                            <p className="text-[9px] tech-mono font-bold uppercase tracking-[0.3em]">
                                {isLocked ? `RETRY_IN_${countdown}S` : 'PERSONAL_OS_V15'}
                            </p>
                        </div>
                    </div>

                    {!isConfigured ? (
                         <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center text-center gap-3 animate-pulse mb-6">
                            <ShieldAlert size={24} className="text-red-500" />
                            <div>
                                <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">CONFIGURATION_VOID</h3>
                                <p className="text-[9px] text-red-400 font-mono leading-relaxed">
                                    System PIN hash is missing.<br/>Configure VITE_VAULT_PIN_HASH in .env
                                </p>
                            </div>
                         </div>
                    ) : (
                        <div className="space-y-6">
                            {isLocked ? (
                                <div className="p-6 bg-red-500/5 rounded-2xl border border-red-500/20 flex flex-col items-center gap-3 text-center">
                                    <Timer size={32} className="text-red-500 animate-spin-slow" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500">
                                        SECURITY PROTOCOL ACTIVATED
                                    </p>
                                    <p className="text-[20px] font-mono font-bold text-white">
                                        00:{countdown.toString().padStart(2, '0')}
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleLogin} className="space-y-6">
                                    <div className="space-y-2 relative group/input">
                                        <label className="text-[8px] tech-mono font-black text-neutral-500 uppercase tracking-widest pl-2 flex items-center gap-2 mb-2">
                                            <Lock size={10} /> ACCESS_CODE
                                        </label>
                                        <div className="relative">
                                            <input 
                                                ref={inputRef}
                                                type="password" 
                                                value={passcode}
                                                onChange={e => { setPasscode(e.target.value); setError(null); }}
                                                className={`
                                                    w-full bg-[#050505] border rounded-2xl py-5 px-6 text-center text-2xl font-black text-white tracking-[0.5em] 
                                                    focus:outline-none transition-all placeholder:text-neutral-800
                                                    ${error 
                                                        ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                                                        : 'border-white/10 focus:border-accent/50 focus:shadow-[0_0_30px_rgba(var(--accent-rgb),0.15)]'
                                                    }
                                                `}
                                                placeholder="••••••"
                                                autoComplete="off"
                                                disabled={loading}
                                                maxLength={6}
                                                inputMode="numeric"
                                            />
                                            {passcode.length > 0 && !loading && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-mono text-neutral-600">
                                                    {passcode.length}/6
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="flex items-center justify-center gap-2 text-red-500 animate-fade-in">
                                            <AlertTriangle size={12} />
                                            <span className="text-[9px] font-bold uppercase tracking-widest">{error}</span>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button 
                                            type="submit" 
                                            disabled={loading || passcode.length < 4} 
                                            className="flex-1 py-5 bg-white text-black hover:bg-accent hover:text-black rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 transition-all shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed group/btn"
                                        >
                                            {loading ? (
                                                <span className="flex items-center gap-2">
                                                    VERIFYING <Loader2 className="animate-spin" size={14} />
                                                </span>
                                            ) : (
                                                <>MASUK <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" /></>
                                            )}
                                        </button>

                                        {isBioEnabled && isBioAvailable && (
                                            <button 
                                                type="button"
                                                onClick={handleBiometricLogin}
                                                disabled={loading}
                                                className="w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-accent hover:bg-white/10 hover:border-accent/50 transition-all active:scale-95"
                                                title="Biometric Login"
                                            >
                                                <ScanFace size={24} />
                                            </button>
                                        )}
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center opacity-50">
                        <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLocked ? 'bg-red-500' : 'bg-green-500'}`}></div>
                            <span className="text-[7px] text-neutral-400 font-mono tracking-widest">
                                {isLocked ? 'THREAT_DETECTED' : 'SYSTEM_ONLINE'}
                            </span>
                        </div>
                        <ScanLine size={12} className="text-neutral-600" />
                    </div>
                </div>
            </div>
        </div>
    );
};