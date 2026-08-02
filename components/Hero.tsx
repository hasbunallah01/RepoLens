import { HeroIllustration } from "./HeroIllustration";
import { HeroSearch } from "./HeroSearch";
import { SparkleIcon } from "./icons";

/**
 * Hero block for the home page: badge, headline, sub-copy, repository
 * search, and the illustration — two columns on desktop, stacked on mobile.
 */
export function Hero() {
  return (
    <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-8">
      <div className="flex flex-col items-start text-left">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-brand-gold/30 bg-brand-gold-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-gold-600">
          <SparkleIcon className="h-3 w-3" />
          AI-Powered Repository Intelligence
        </span>

        <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight text-brand-navy sm:text-5xl">
          Understand Any GitHub Repository{" "}
          <span className="text-brand-teal">with AI.</span>
        </h1>

        <p className="mt-5 max-w-lg text-base text-slate-500 sm:text-lg">
          RepoLens analyzes repositories, builds intelligent context, and
          answers natural-language questions about the codebase.
        </p>

        <div className="mt-8 w-full max-w-xl">
          <HeroSearch />
        </div>
      </div>

      <HeroIllustration />
    </div>
  );
}
