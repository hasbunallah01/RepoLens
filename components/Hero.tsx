import Image from "next/image";
import { Sparkles, Github, Folder, Code2, Share2 } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";

/** Small floating glass card that carries an icon in the hero art. */
function FloatingCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute hidden items-center justify-center rounded-2xl border border-border bg-card shadow-float md:flex ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/**
 * Landing hero: headline + search on the left, 3D brand art with
 * floating icon cards on the right.
 */
export function Hero() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-8">
      {/* Left column */}
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/40 bg-brand-gold-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-gold-600">
          <Sparkles className="h-3.5 w-3.5" />
          AI-Powered Repository Intelligence
        </span>

        <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-brand-navy text-balance sm:text-5xl lg:text-6xl">
          Understand Any
          <br />
          GitHub Repository
          <br />
          <span className="text-brand-teal">with AI.</span>
        </h1>

        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
          RepoLens analyzes repositories, builds intelligent context, and
          answers natural-language questions about the codebase.
        </p>

        <div className="mt-8 max-w-xl">
          <SearchBar />
        </div>
      </div>

      {/* Right column: 3D art with floating cards */}
      <div className="relative mx-auto w-full max-w-lg">
        {/* Decorative sparkles */}
        <span className="absolute left-2 top-10 text-brand-teal/40" aria-hidden="true">
          <Sparkles className="h-4 w-4" />
        </span>
        <span
          className="absolute right-8 top-2 text-brand-gold/50"
          aria-hidden="true"
        >
          <Sparkles className="h-3 w-3" />
        </span>
        <span
          className="absolute bottom-10 left-10 text-brand-gold/40"
          aria-hidden="true"
        >
          <Sparkles className="h-3 w-3" />
        </span>

        {/* Floating cards */}
        <FloatingCard className="left-0 top-6 h-14 w-14">
          <Github className="h-6 w-6 text-brand-navy" />
        </FloatingCard>
        <FloatingCard className="right-2 top-10 h-14 w-14">
          <Folder className="h-6 w-6 text-brand-teal" />
        </FloatingCard>
        <FloatingCard className="bottom-24 left-2 h-14 w-14">
          <Code2 className="h-6 w-6 text-brand-gold-600" />
        </FloatingCard>
        <FloatingCard className="bottom-14 right-0 h-14 w-14">
          <Share2 className="h-6 w-6 text-brand-teal" />
        </FloatingCard>

        <Image
          src="/assets/hero-illustration.png"
          alt="RepoLens 3D logo: a magnifying glass over a repository"
          width={560}
          height={560}
          priority
          className="relative z-10 h-auto w-full"
        />
      </div>
    </div>
  );
}
