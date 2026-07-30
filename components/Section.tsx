import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** Reduce vertical padding for tighter sections. */
  compact?: boolean;
}

/**
 * Vertical section block with consistent top/bottom rhythm.
 */
export function Section({ children, compact = false, className, ...rest }: SectionProps) {
  return (
    <section
      className={cn(compact ? "py-12 md:py-16" : "py-20 md:py-28", className)}
      {...rest}
    >
      {children}
    </section>
  );
}
