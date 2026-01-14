import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'full';
    children: React.ReactNode;
    footer?: React.ReactNode;
}

const getSizeClass = (size: DialogProps['size']) => {
    switch (size) {
        case 'sm': return 'max-w-md';
        case 'lg': return 'max-w-4xl';
        case 'full': return 'w-full h-full max-w-none';
        default: return 'max-w-2xl';
    }
};

export const Dialog: React.FC<DialogProps> = ({ open, onClose, title, size = 'md', children, footer }) => {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) onClose();
        };
        if (open) {
            previouslyFocused.current = document.activeElement as HTMLElement;
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKey);
            setTimeout(() => {
                const node = overlayRef.current;
                const focusable = node?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                focusable?.focus();
            }, 0);
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            window.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
            previouslyFocused.current?.focus();
        };
    }, [open, onClose]);

    if (!open) return null;

    const content = (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[1200] bg-[rgb(var(--overlay-rgb)/0.6)] backdrop-blur-sm flex items-center justify-center px-4 py-10 md:py-16"
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Dialog'}
            onKeyDown={(e) => {
                if (e.key !== 'Tab') return;
                const focusables = overlayRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (!focusables || focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }}
        >
            <div className={`relative w-full ${getSizeClass(size)} max-h-full overflow-hidden rounded-3xl border border-skin-border bg-skin-card shadow-[var(--shadow-strong)] flex flex-col`}>
                <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-skin-border bg-skin-surface">
                    <div>
                        <p className="overline text-skin-muted">{title || 'Dialog'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-skin-muted hover:text-skin-text hover:bg-skin-surface-hover transition-all"
                        aria-label="Close dialog"
                        type="button"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-auto px-6 py-5 custom-scroll bg-skin-card">
                    {children}
                </div>
                {footer && (
                    <div className="border-t border-skin-border bg-skin-surface px-6 py-4 flex items-center justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(content, document.body);
};
