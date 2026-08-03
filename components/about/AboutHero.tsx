import { Button } from "@/components/Button";
import { CodeIcon, GitHubIcon, PieChartIcon, StarIcon, BarChartIcon } from "@/components/icons";

/**
 * About page hero: eyebrow, headline, copy, CTAs, and a lightweight
 * illustration echoing the analyze dashboard (browser-card + donut +
 * stat chip), matching the reference composition.
 */
export function AboutHero() {
  return (
    <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-8">
      <div>
        <span className="inline-flex items-center rounded-full bg-brand-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-teal">
          About RepoLens
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-brand-navy sm:text-4xl md:text-[2.75rem]">
          Understand any GitHub repository with{" "}
          <span className="text-brand-teal">fewer tokens.</span>
        </h1>
        <p className="mt-4 max-w-lg text-base text-slate-500">
          RepoLens uses the power of Paritok to intelligently rank and retrieve the
          most relevant files, build optimal context, and help AI answer your
          questions accurately and efficiently.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/analyze" size="lg">
            Analyze a Repository
            <span aria-hidden="true">→</span>
          </Button>
          <Button
            href="https://github.com/hasbunallah01/RepoLens"
            variant="secondary"
            size="lg"
          >
            View on GitHub
          </Button>
        </div>
      </div>

      <HeroIllustration />
    </div>
  );
}

function HeroIllustration() {
  return (
    <div className="relative mx-auto flex h-64 w-full max-w-md items-center justify-center sm:h-72">
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-200" />
          <span className="h-2 w-2 rounded-full bg-slate-200" />
          <span className="h-2 w-2 rounded-full bg-slate-200" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-16 w-3 rounded-full bg-brand-navy/80" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-2/3 rounded-full bg-slate-100" />
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#0c8974"
                  strokeWidth="6"
                  strokeDasharray="60 88"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#f1962a"
                  strokeWidth="6"
                  strokeDasharray="20 88"
                  strokeDashoffset="-60"
                />
              </svg>
              <div className="flex-1 space-y-1.5">
                <div className="h-2 w-full rounded-full bg-slate-100" />
                <div className="h-2 w-4/5 rounded-full bg-slate-100" />
                <div className="h-2 w-3/5 rounded-full bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <span className="absolute -top-3 right-6 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-navy shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <CodeIcon className="h-4 w-4" />
      </span>
      <span className="absolute right-0 top-1/3 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-gold shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <StarIcon className="h-4 w-4" />
      </span>
      <span className="absolute bottom-2 left-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-teal shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <BarChartIcon className="h-4 w-4" />
      </span>
      <span className="absolute left-8 top-6 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-400 shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <GitHubIcon className="h-4 w-4" />
      </span>
      <span className="absolute bottom-6 right-10 flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brand-teal shadow-md shadow-slate-200 ring-1 ring-slate-100">
        <PieChartIcon className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}
