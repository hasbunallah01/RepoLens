import { Button } from "@/components/Button";
import { ChatIcon, SearchIcon } from "@/components/icons";

interface BottomCTAProps {
  href?: string;
}

/**
 * "Ask Questions About This Repository" CTA strip shown after analysis.
 */
export function BottomCTA({ href = "/ask" }: BottomCTAProps) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl bg-brand-teal-50 p-6 sm:flex-row sm:justify-between sm:p-8">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className="relative flex h-14 w-16 shrink-0 items-center justify-center">
          <ChatIcon className="absolute left-0 h-8 w-8 -rotate-6 text-brand-navy/70" aria-hidden="true" />
          <span className="absolute right-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-teal text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <circle cx="9" cy="10" r="1.2" fill="currentColor" />
              <circle cx="12.5" cy="10" r="1.2" fill="currentColor" />
              <circle cx="16" cy="10" r="1.2" fill="currentColor" />
              <path
                d="M4 6h16v9H9l-3 3v-3H4V6Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-brand-navy sm:text-xl">
            Ask Questions About This Repository
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            RepoLens has built context and is ready to answer your questions about this codebase.
          </p>
        </div>
      </div>
      <Button href={href} size="lg" className="w-full shrink-0 sm:w-auto">
        <SearchIcon className="h-4 w-4" />
        Ask AI About This Repo
      </Button>
    </div>
  );
}
