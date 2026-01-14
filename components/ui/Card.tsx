import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const cardVariants = cva(
  'rounded-[var(--radius-lg)] border border-border bg-surface text-text shadow-[var(--shadow-soft)]',
  {
    variants: {
      tone: {
        default: 'bg-surface',
        muted: 'bg-surface-2'
      },
      interactive: {
        true: 'transition-all hover:border-accent/30 hover:shadow-[var(--shadow-strong)] active:translate-y-px'
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

export interface CardProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof cardVariants> {
  as?: CardElement;
}

export const Card = React.forwardRef<HTMLElement, CardProps>(
  ({ as = 'div', className, tone, interactive, padding, ...props }, ref) => {
    const Component = as;
    return (
      <Component
        ref={ref as React.Ref<HTMLElement>}
        className={cn(cardVariants({ tone, interactive, padding }), className)}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
