import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  accent?: "teal" | "gold";
  className?: string;
}

/**
 * Feature highlight card used on the home page.
 * Borderless, centered — icon in a soft tinted circle, bold title, muted copy.
 */
export function FeatureCard({ title, description, icon, accent = "teal", className }: FeatureCardProps) {
  const iconWrap =
    accent === "gold"
      ? "bg-brand-gold-50 text-brand-gold"
      : "bg-brand-teal-50 text-brand-teal";

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-slate-100 p-6 text-center transition-shadow hover:shadow-sm hover:shadow-slate-100",
        className,
      )}
    >
      <div className={cn("mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full", iconWrap)}>
        {icon}
      </div>
      <h3 className="text-base font-bold text-brand-navy">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}
