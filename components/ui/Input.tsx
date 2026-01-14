import React from 'react';
import { cn } from '../../utils/cn';

const baseInputClass =
  'w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-50';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseInputClass, className)} {...props} />
  )
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseInputClass, 'min-h-[120px] resize-y', className)} {...props} />
  )
);

Textarea.displayName = 'Textarea';
