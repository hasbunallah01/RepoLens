import { RobotIcon } from "@/components/icons";
import { SuggestedQuestions } from "./SuggestedQuestions";
import type { SuggestedQuestion } from "@/lib/mock-ask-data";

interface AskGreetingProps {
  questions: SuggestedQuestion[];
  onSelectQuestion: (question: SuggestedQuestion) => void;
}

/**
 * "Hi! I'm RepoLens AI" greeting + suggested questions card.
 */
export function AskGreeting({ questions, onSelectQuestion }: AskGreetingProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-100 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-teal-50">
          <RobotIcon className="h-6 w-6 text-brand-teal" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-brand-navy">Hi! I&apos;m RepoLens AI</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Ask me anything about this repository. I can help you understand the code,
            explain how things work, find specific information, and more.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <SuggestedQuestions questions={questions} onSelect={onSelectQuestion} />
      </div>
    </div>
  );
}
