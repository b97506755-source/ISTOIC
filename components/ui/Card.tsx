import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const cardVariants = cva(
  'rounded-[var(--radius-lg)] border border-border/70 bg-surface text-text shadow-[var(--shadow-soft)] backdrop-blur',
  {
    variants: {
      tone: {
        default: 'bg-surface',
        muted: 'bg-surface-2',
        translucent: 'bg-white/5 dark:bg-white/2 border-white/10 shadow-[0_20px_80px_-40px_rgba(var(--accent-rgb),0.4)]'
      },
      interactive: {
        true: 'transition-all hover:border-accent/40 hover:shadow-[var(--shadow-strong)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]'
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8'
      }
    },
    defaultVariants: {
      tone: 'default',
      padding: 'md'
    }
  }
);

type CardElement = 'div' | 'section' | 'article' | 'button';

type CardProps<T extends CardElement = 'div'> = {
  as?: T;
  className?: string;
} & VariantProps<typeof cardVariants> &
  Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export const Card = React.forwardRef(
  <T extends CardElement = 'div'>(
    { as, className, tone, interactive, padding, ...props }: CardProps<T>,
    ref: React.ComponentPropsWithRef<T>['ref']
  ) => {
    const Component = (as ?? 'div') as T;
    return (
      <Component
        ref={ref}
        className={cn(cardVariants({ tone, interactive, padding }), className)}
        {...(props as React.ComponentPropsWithoutRef<T>)}
      />
    );
  }
);

Card.displayName = 'Card';
