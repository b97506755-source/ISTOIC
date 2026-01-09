import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

const glassCardVariants = cva(
  "relative overflow-hidden rounded-[24px] border border-glass-border bg-glass-gradient backdrop-blur-xl shadow-glass transition-all duration-300",
  {
    variants: {
      variant: {
        default: "hover:border-white/10",
        interactive: "cursor-pointer hover:bg-glass-active hover:shadow-glow-sm hover:-translate-y-1 active:scale-[0.98]",
        featured: "bg-gradient-to-br from-glass-100 to-glass-200 border-white/20 shadow-lg",
        ghost: "bg-transparent border-transparent shadow-none hover:bg-glass-100",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  children: React.ReactNode;
  glow?: boolean;
  variant?: "default" | "interactive" | "featured" | "ghost" | null;
  padding?: "none" | "sm" | "md" | "lg" | null;
  className?: string;
  onClick?: () => void;
}

const MotionDiv = motion.div as any;

export const GlassCard: React.FC<GlassCardProps> = ({
  className,
  variant,
  padding,
  children,
  glow,
  ...props
}) => {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(glassCardVariants({ variant, padding, className }))}
      {...props}
    >
      {glow && (
        <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}
      <div className="relative z-10 h-full">{children}</div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
    </MotionDiv>
  );
};