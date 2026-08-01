import { RepoQuickSearch } from "./home/RepoQuickSearch";
import { HeroIllustration } from "./home/HeroIllustration";

/**
 * Home page hero: eyebrow badge, headline, subcopy, quick-search, and the
 * large 3D mark illustration — matching the approved landing-page design.
 */
export function Hero() {
  return (
    <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-10">
      <div className="text-center lg:text-left">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold-100/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-gold-600">
          <span aria-hidden="true">+</span>
          AI-Powered Repository Intelligence
        </span>

        <h1 className="text-4xl font-bold tracking-tight text-brand-navy sm:text-5xl md:text-[3.25rem] md:leading-[1.05]">
          Understand Any GitHub Repository <span className="text-brand-teal">with AI.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base text-slate-500 sm:text-lg lg:mx-0">
          RepoLens analyzes repositories, builds intelligent context, and
          answers natural-language questions about the codebase.
        </p>

        <div className="mx-auto mt-8 max-w-xl lg:mx-0">
          <RepoQuickSearch />
        </div>
      </div>

      <HeroIllustration />
    </div>
  );
}
