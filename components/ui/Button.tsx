import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-0.5',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-2)] text-[color:var(--text-invert)] shadow-[0_14px_40px_-18px_rgba(var(--accent-rgb),0.8)] hover:shadow-[0_18px_50px_-16px_rgba(var(--accent-rgb),0.9)]',
        secondary:
          'bg-surface text-text border border-border/70 hover:border-accent/50 hover:bg-surface-2 shadow-[var(--shadow-soft)]',
        ghost: 'bg-transparent text-text hover:bg-surface-2 border border-transparent hover:border-border/60',
        destructive: 'bg-danger text-text-invert hover:bg-danger/90 shadow-[0_10px_30px_-18px_rgba(220,38,38,0.8)]',
        subtle: 'bg-surface-2 text-text border border-border/60 hover:border-accent/30 hover:bg-surface shadow-[var(--shadow-soft)]'
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-5 text-sm'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);

Button.displayName = 'Button';
