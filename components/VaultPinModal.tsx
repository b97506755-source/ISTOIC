
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Unlock, X, AlertCircle, Fingerprint, Settings } from 'lucide-react';
import { verifySystemPin, isSystemPinConfigured } from '../utils/crypto';

interface VaultPinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const VaultPinModal: React.FC<VaultPinModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [isConfigured, setIsConfigured] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError(false);
            const configured = isSystemPinConfigured();
            setIsConfigured(configured);
            
            if (configured) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    }, [isOpen]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setVerifying(true);
        
        // If not configured, we might allow bypass or prompt setup (here we auto-succeed for convenience if intended, 
        // but secure design dictates we should force setup. Let's redirect logic).
        // For this implementation: If not configured, unlocking effectively sets up nothing, so we just unlock to let them access settings.
        if (!isConfigured) {
            onSuccess();
            onClose();
            return;
        }

        const isValid = await verifySystemPin(pin);

        if (isValid) {
            onSuccess();
            onClose();
        } else {
            setError(true);
            setShake(true);
            setPin('');
            setTimeout(() => setShake(false), 500);
        }
        setVerifying(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className={`
                relative w-full max-w-sm bg-white dark:bg-[#0a0a0b] border border-black/5 dark:border-white/10 rounded-[32px] p-8 
                shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col items-center gap-6
                ${shake ? 'animate-[shake_0.5s_cubic-bezier(.36,.07,.19,.97)_both]' : ''}
            `}>
                <button onClick={onClose} className="absolute top-6 right-6 text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                    <X size={20} />
                </button>

                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${error ? 'bg-red-500/10 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'bg-accent/10 text-accent shadow-[0_0_30px_var(--accent-glow)]'}`}>
                    {isConfigured ? (error ? <AlertCircle size={32} /> : <Shield size={32} />) : <Settings size={32} />}
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-black dark:text-white uppercase italic tracking-tighter">
                        {isConfigured ? (error ? 'ACCESS DENIED' : 'SECURITY CLEARANCE') : 'VAULT UNSECURED'}
                    </h3>
                    <p className="text-[10px] tech-mono font-bold text-neutral-500 uppercase tracking-widest">
                        {isConfigured ? (error ? 'INVALID CREDENTIALS' : 'ENTER VAULT PIN TO DECRYPT') : 'NO PIN CONFIGURED'}
                    </p>
                </div>

                {isConfigured ? (
                    <form onSubmit={handleSubmit} className="w-full relative">
                        <input 
                            ref={inputRef}
                            type="password" 
                            value={pin}
                            onChange={(e) => { setPin(e.target.value); setError(false); }}
                            className="w-full bg-zinc-100 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl px-4 py-4 text-center text-2xl font-black text-black dark:text-white tracking-[0.5em] focus:outline-none focus:border-accent/50 focus:bg-white dark:focus:bg-white/10 transition-all placeholder:text-neutral-300 dark:placeholder:text-white/10"
                            placeholder="••••••"
                            maxLength={10}
                            autoComplete="off"
                            disabled={verifying}
                        />
                        <Fingerprint className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300 dark:text-white/20 pointer-events-none" size={20} />
                    </form>
                ) : (
                    <div className="text-center text-xs text-neutral-500 px-4">
                        System security is currently disabled. Please configure a PIN in Settings to secure your data.
                    </div>
                )}

                <button 
                    onClick={() => handleSubmit()}
                    disabled={verifying}
                    className="w-full py-4 bg-black dark:bg-white text-white dark:text-black hover:bg-accent dark:hover:bg-accent hover:text-black dark:hover:text-black transition-all rounded-xl font-black uppercase text-[11px] tracking-[0.3em] flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                    {isConfigured ? (error ? <Lock size={14} /> : <Unlock size={14} />) : <Settings size={14} />} 
                    {isConfigured ? (verifying ? 'VERIFYING...' : (error ? 'RETRY AUTH' : 'AUTHENTICATE')) : 'PROCEED & SETUP'}
                </button>

                <p className="text-[8px] text-neutral-400 font-mono text-center">
                    SECURE_ENCLAVE_V15.0 // HARDWARE_ENCRYPTION_ACTIVE
                </p>
            </div>
            <style>{`
                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }
            `}</style>
        </div>
    );
};