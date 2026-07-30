import { Button } from "./Button";

/**
 * Hero block for the home page.
 * Phase 1: headline, tagline, and a non-functional CTA.
 */
export function Hero() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900/60 px-3 py-1 text-xs font-medium text-navy-100">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Built for the Build with Paritok Hackathon
      </span>

      <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
        Understand any codebase with{" "}
        <span className="text-gradient-emerald">fewer tokens</span>.
      </h1>

      <p className="mt-6 max-w-2xl text-base text-navy-200 sm:text-lg">
        RepoLens is the developer&apos;s lens into any GitHub repository. Stop
        dumping entire codebases into prompts — let RepoLens retrieve only what
        matters and route it through Paritok for maximum token efficiency.
      </p>

      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
        <Button size="lg" aria-label="Analyze a repository (coming soon)">
          Analyze Repository
        </Button>
        <Button href="/about" variant="secondary" size="lg">
          Learn more
        </Button>
      </div>
    </div>
  );
}
