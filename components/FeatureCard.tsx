import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  /** Icon tint — alternates gold/teal to match the brand accent rhythm. */
  tone?: "teal" | "gold";
  className?: string;
}

/**
 * Feature highlight card used on the home page.
 * Light-theme card: white surface, soft border, teal/gold icon tint.
 */
export function FeatureCard({ title, description, icon, tone = "teal", className }: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border border-slate-200 bg-white p-6",
        "transition-all hover:-translate-y-0.5 hover:border-brand-teal/30 hover:shadow-lg hover:shadow-slate-200/60",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ring-1",
          tone === "teal"
            ? "bg-brand-teal-100/60 text-brand-teal ring-brand-teal/20"
            : "bg-brand-gold-100/70 text-brand-gold-600 ring-brand-gold/25",
        )}
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold text-brand-navy">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}
