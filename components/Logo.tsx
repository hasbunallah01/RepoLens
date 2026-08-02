import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Show the wordmark next to the mark. Defaults to true. */
  withWordmark?: boolean;
}

/**
 * RepoLens logo — a stylised lens/magnifier formed by concentric arcs
 * with an emerald accent dot. Pure SVG, no external assets.
 */
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="2" />
        <path
          d="M21 21L27 27"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="14" cy="14" r="4" fill="#10b981" />
      </svg>
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight text-white">
          Repo<span className="text-emerald-400">Lens</span>
        </span>
      )}
    </span>
  );
}
