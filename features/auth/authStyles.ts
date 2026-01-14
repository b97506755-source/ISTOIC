/**
 * Authentication Styles
 * Uses CSS variables for consistency with main ISTOIC theme
 */
export const authStyles = {
  // Card & Container Styles
  card: "backdrop-blur-2xl border border-[color:var(--border)]/60 bg-[color:var(--surface)]/95 rounded-[28px] p-8 shadow-[0_40px_140px_-80px_rgba(var(--accent-rgb),0.8)] relative overflow-hidden",
  
  // Typography Styles
  title: "text-xl font-black text-[var(--text)] uppercase tracking-tight",
  subtitle: "text-[10px] text-[var(--text-muted)] font-mono mt-1 uppercase tracking-[0.2em]",
  label: "text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest ml-1",
  
  // Input Styles
  input:
    "w-full bg-[var(--surface-2)] border border-[color:var(--border)]/60 rounded-2xl px-5 py-4 text-sm font-semibold text-[var(--text)] focus:border-[color:var(--accent)]/80 focus:ring-2 focus:ring-[color:var(--accent)]/20 outline-none transition-all placeholder:text-[var(--text-muted)]/50",
  inputIconWrap:
    "w-full bg-[var(--surface-2)] border border-[color:var(--border)]/60 rounded-2xl px-5 py-4 pl-12 text-sm font-semibold text-[var(--text)] focus:border-[color:var(--accent)]/80 focus:ring-2 focus:ring-[color:var(--accent)]/20 outline-none transition-all placeholder:text-[var(--text-muted)]/50",
  inputError: "border-[color:var(--danger)]/60 focus:border-[color:var(--danger)] focus:ring-[color:var(--danger)]/20",
  
  // Button Styles
  buttonPrimary:
    "w-full py-4 bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] text-[color:var(--text-invert)] rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_18px_40px_-18px_rgba(var(--accent-rgb),0.9)] hover:shadow-[0_22px_55px_-16px_rgba(var(--accent-rgb),0.9)] active:scale-95 disabled:opacity-70",
  buttonSecondary:
    "w-full py-4 bg-[color:var(--surface-2)] text-[color:var(--text)] rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-[var(--shadow-soft)] border border-[color:var(--border)]/70 hover:border-[color:var(--accent)]/40 active:scale-95 disabled:opacity-70",
  buttonGhost:
    "w-full py-3 text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--accent)] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors",
  linkMuted: "text-[9px] font-bold text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors",
  
  // Alert Styles
  alertError:
    "p-3 bg-[var(--danger)]/10 border border-[color:var(--danger)]/30 rounded-xl text-[var(--danger)] text-xs font-bold text-center mb-4 flex items-center justify-center gap-2",
  alertInfo:
    "p-3 bg-[var(--info)]/10 border border-[color:var(--info)]/30 rounded-xl text-[var(--info)] text-xs font-bold text-center mb-4",
  alertSuccess:
    "p-3 bg-[var(--success)]/10 border border-[color:var(--success)]/30 rounded-xl text-[var(--success)] text-xs font-bold text-center mb-4",
};
