import { CheckCircleIcon, FileIcon, FolderIcon, XCircleIcon } from "@/components/icons";
import { SectionHeading } from "./SectionHeading";
import { WITHOUT_REPOLENS, WITH_REPOLENS } from "@/lib/mock-about-data";

/**
 * "The Problem We Solve" — Without RepoLens vs With RepoLens comparison.
 */
export function ProblemWeSolve() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-100 sm:p-8">
      <SectionHeading eyebrow="The Problem We Solve" title="AI needs the right context, not all the context." />

      <div className="mt-8 grid grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-xl border border-red-100 bg-red-50/60 p-5">
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-bold text-red-600">Without RepoLens</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {WITHOUT_REPOLENS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                <XCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end">
            <span className="relative flex h-16 w-14 items-center justify-center">
              <FileIcon className="h-12 w-10 text-red-200" />
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
                !
              </span>
            </span>
          </div>
        </div>

        <div className="hidden h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 lg:flex">
          →
        </div>

        <div className="rounded-xl border border-brand-teal/20 bg-brand-teal-50/60 p-5">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-brand-teal" />
            <h3 className="text-sm font-bold text-brand-teal">With RepoLens</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {WITH_REPOLENS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-teal" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end">
            <span className="relative flex h-16 w-14 items-center justify-center">
              <FolderIcon className="h-12 w-12 text-brand-teal/30" />
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-teal text-white">
                <CheckCircleIcon className="h-3.5 w-3.5" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
