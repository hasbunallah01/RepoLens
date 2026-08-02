import { cn } from "@/lib/utils";

/**
 * Small centered teal uppercase label used above landing sections
 * (e.g. "HOW IT WORKS", "POWERFUL FEATURES").
 */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-center text-xs font-bold uppercase tracking-[0.18em] text-brand-teal",
        className,
      )}
    >
      {children}
    </p>
  );
}
