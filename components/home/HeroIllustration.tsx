import type { ReactNode } from "react";

/**
 * Large 3D RepoLens mark with orbiting icon badges, matching the approved
 * landing-page mockup. Pure markup + existing brand asset — no new deps.
 */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md select-none">
      {/* Ambient glow behind the mark */}
      <div
        aria-hidden="true"
        className="absolute inset-4 rounded-full bg-gradient-to-br from-brand-teal-100/70 via-white to-brand-gold-100/50 blur-2xl"
      />

      {/* Decorative gold dots */}
      <span aria-hidden="true" className="absolute left-6 top-10 h-2 w-2 rounded-full bg-brand-gold/70" />
      <span aria-hidden="true" className="absolute left-14 top-4 h-1.5 w-1.5 rounded-full bg-brand-gold/50" />
      <span aria-hidden="true" className="absolute right-10 bottom-24 h-1.5 w-1.5 rounded-full bg-brand-teal/40" />

      {/* Podium shadow */}
      <div
        aria-hidden="true"
        className="absolute inset-x-12 bottom-10 h-6 rounded-[100%] bg-brand-navy/10 blur-md"
      />

      {/* The mark */}
      <img
        src="/assets/logo-square.png"
        alt="RepoLens"
        className="absolute inset-0 z-10 m-auto h-2/3 w-2/3 object-contain drop-shadow-xl"
      />

      {/* Floating badges */}
      <Badge className="left-2 top-6" tone="navy">
        <GithubIcon className="h-4 w-4" />
      </Badge>
      <Badge className="right-0 top-16" tone="gold">
        <FolderIcon className="h-4 w-4" />
      </Badge>
      <Badge className="left-4 bottom-10" tone="gold">
        <CodeIcon className="h-4 w-4" />
      </Badge>
      <Badge className="right-4 bottom-16" tone="teal">
        <ShareIcon className="h-4 w-4" />
      </Badge>
    </div>
  );
}

function Badge({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone: "navy" | "teal" | "gold";
}) {
  const toneClasses =
    tone === "navy"
      ? "text-brand-navy"
      : tone === "teal"
        ? "text-brand-teal"
        : "text-brand-gold-600";
  return (
    <div
      className={`absolute z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-md shadow-slate-200/60 ${toneClasses} ${className}`}
    >
      {children}
    </div>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.13c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.73.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.07.78 2.17v3.21c0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M8 8l-5 4 5 4M16 8l5 4-5 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11l7-3.5M8 13l7 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
