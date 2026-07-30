import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  className?: string;
}

/**
 * Feature highlight card used on the home page.
 * Phase 1: presentation only. No business logic.
 */
export function FeatureCard({ title, description, icon, className }: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border border-navy-800/70 bg-navy-900/40 p-6",
        "transition-all hover:border-emerald-500/40 hover:bg-navy-900/70",
        className,
      )}
    >
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-navy-200">{description}</p>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/0 transition-colors group-hover:bg-emerald-500/5"
      />
    </div>
  );
}
