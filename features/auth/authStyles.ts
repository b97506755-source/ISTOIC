export const authStyles = {
  card: "relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)]/92 p-[var(--space-6)] shadow-[var(--shadow)] backdrop-blur-xl",
  title: "text-xl font-semibold text-[var(--text-primary)] uppercase tracking-tight",
  subtitle: "text-[10px] text-[var(--text-muted)] font-mono mt-[var(--space-1)] uppercase tracking-[0.2em]",
  label: "text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest ml-[var(--space-1)]",
  input:
    "w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)] text-sm font-semibold text-[var(--text-primary)] focus:border-accent focus:ring-2 focus:ring-[rgba(var(--accent-rgb),0.25)] outline-none transition-all placeholder:text-[var(--text-muted)]",
  inputIconWrap:
    "w-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)] pl-[var(--space-6)] text-sm font-semibold text-[var(--text-primary)] focus:border-accent focus:ring-2 focus:ring-[rgba(var(--accent-rgb),0.25)] outline-none transition-all placeholder:text-[var(--text-muted)]",
  inputError: "border-[var(--danger)] focus:border-[var(--danger)]",
  buttonPrimary:
    "w-full py-[var(--space-4)] bg-[var(--accent)] text-[var(--accent-foreground)] hover:brightness-105 rounded-[var(--radius-md)] font-semibold uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-[var(--space-2)] transition-all duration-200 shadow-[var(--shadow)] active:scale-[0.98] disabled:opacity-60",
  buttonSecondary:
    "w-full py-[var(--space-4)] bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-[var(--radius-md)] font-semibold uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-[var(--space-2)] shadow-[var(--shadow)] active:scale-[0.98] disabled:opacity-60",
  buttonGhost:
    "w-full py-[var(--space-3)] text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-[0.2em] flex items-center justify-center gap-[var(--space-2)]",
  linkMuted: "text-[9px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]",
  alertError:
    "p-[var(--space-3)] bg-[var(--danger-soft)] border border-[var(--danger)] rounded-[var(--radius-sm)] text-[var(--danger)] text-xs font-semibold text-center mb-[var(--space-4)] flex items-center justify-center gap-[var(--space-2)]",
  alertInfo:
    "p-[var(--space-3)] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-sm)] text-[var(--text-secondary)] text-xs font-semibold text-center mb-[var(--space-4)]",
  alertSuccess:
    "p-[var(--space-3)] bg-[var(--success-soft)] border border-[var(--success)] rounded-[var(--radius-sm)] text-[var(--success)] text-xs font-semibold text-center mb-[var(--space-4)]",
};
