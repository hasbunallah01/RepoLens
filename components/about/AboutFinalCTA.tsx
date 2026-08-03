import { Button } from "@/components/Button";
import { RocketIcon } from "@/components/icons";

/**
 * Final call-to-action strip closing out the About page.
 */
export function AboutFinalCTA() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl bg-brand-navy p-8 text-center sm:flex-row sm:justify-between sm:text-left">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
          <RocketIcon className="h-6 w-6 -rotate-45" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">
            Ready to explore a repository?
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Analyze any GitHub repo and start asking meaningful questions in seconds.
          </p>
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button href="/analyze" size="lg" className="w-full sm:w-auto">
          Analyze Repository
        </Button>
        <Button
          href="https://github.com/hasbunallah01/RepoLens/tree/main/docs"
          size="lg"
          className="w-full !border !border-white/30 !bg-transparent !text-white hover:!bg-white/10 sm:w-auto"
        >
          View Documentation
        </Button>
      </div>
    </div>
  );
}
