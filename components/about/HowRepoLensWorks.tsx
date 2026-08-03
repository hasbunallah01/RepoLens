import {
  ChatIcon,
  DatabaseIcon,
  FileIcon,
  GitHubIcon,
  SearchIcon,
  TargetIcon,
} from "@/components/icons";
import { SectionHeading } from "./SectionHeading";
import { WORKFLOW_STEPS, type WorkflowStep } from "@/lib/mock-about-data";

const ICONS: Record<WorkflowStep["icon"], React.ReactNode> = {
  github: <GitHubIcon className="h-5 w-5" />,
  search: <SearchIcon className="h-5 w-5" />,
  database: <DatabaseIcon className="h-5 w-5" />,
  target: <TargetIcon className="h-5 w-5" />,
  file: <FileIcon className="h-5 w-5" />,
  chat: <ChatIcon className="h-5 w-5" />,
};

/**
 * "How RepoLens Works" — six connected steps, from repo to answer.
 */
export function HowRepoLensWorks() {
  return (
    <div>
      <SectionHeading eyebrow="How RepoLens Works" title="From repository to answer in 6 simple steps" />

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:flex lg:items-stretch lg:gap-0">
        {WORKFLOW_STEPS.map((step, i) => (
          <div key={step.step} className="flex lg:flex-1 lg:items-center">
            <div className="flex h-full flex-col items-center rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm shadow-slate-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-teal text-[10px] font-bold text-white">
                {step.step}
              </span>
              <span className="mt-2 flex h-11 w-11 items-center justify-center rounded-full bg-brand-teal-50 text-brand-teal">
                {ICONS[step.icon]}
              </span>
              <h3 className="mt-2.5 text-xs font-bold text-brand-navy sm:text-sm">{step.title}</h3>
              <p className="mt-1 text-[11px] leading-snug text-slate-500 sm:text-xs">{step.description}</p>
            </div>
            {i < WORKFLOW_STEPS.length - 1 ? (
              <div className="hidden w-6 shrink-0 items-center justify-center text-slate-300 lg:flex">
                →
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
