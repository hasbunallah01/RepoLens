import type { ReactNode } from "react";
import { Container } from "./Container";
import { ArrowDownIcon, ArrowRightIcon, BrainIcon, ChatIcon, FolderIcon } from "./icons";

interface Step {
  number: number;
  title: string;
  description: string;
  icon: ReactNode;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Analyze",
    description: "RepoLens scans the repository structure and indexes the important files.",
    icon: <FolderIcon className="h-6 w-6" />,
  },
  {
    number: 2,
    title: "Understand",
    description: "The AI builds a contextual understanding of the codebase.",
    icon: <BrainIcon className="h-6 w-6" />,
  },
  {
    number: 3,
    title: "Ask",
    description: "Ask questions in plain English and receive code-aware answers.",
    icon: <ChatIcon className="h-6 w-6" />,
  },
];

/**
 * "How It Works" — three numbered steps connected by arrows.
 * Horizontal with → connectors on desktop, stacked with ↓ on mobile.
 */
export function HowItWorks() {
  return (
    <Container>
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-brand-teal">
        How It Works
      </p>

      <div className="mt-6 flex flex-col items-stretch gap-0 md:flex-row md:items-center md:gap-4">
        {STEPS.map((step, i) => (
          <div key={step.number} className="flex flex-col items-center md:flex-1 md:flex-row">
            <StepCard step={step} />
            {i < STEPS.length - 1 ? (
              <>
                <ArrowDownIcon className="my-2 h-5 w-5 shrink-0 text-slate-300 md:hidden" aria-hidden="true" />
                <ArrowRightIcon
                  className="mx-2 hidden h-5 w-5 shrink-0 text-slate-300 md:block"
                  aria-hidden="true"
                />
              </>
            ) : null}
          </div>
        ))}
      </div>
    </Container>
  );
}

function StepCard({ step }: { step: Step }) {
  return (
    <div className="flex w-full items-start gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-100 md:h-full">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-teal-50 text-brand-teal">
        {step.icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-teal text-[11px] font-bold text-white">
            {step.number}
          </span>
          <h3 className="text-base font-bold text-brand-navy">{step.title}</h3>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{step.description}</p>
      </div>
    </div>
  );
}
