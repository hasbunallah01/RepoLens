"use client";

import { useState } from "react";
import { ChevronRightIcon, SparkleIcon } from "@/components/icons";
import type { SuggestedQuestion } from "@/lib/mock-ask-data";

interface SuggestedQuestionsProps {
  questions: SuggestedQuestion[];
  onSelect: (question: SuggestedQuestion) => void;
  /** Below this index, cards are hidden on mobile until "Show more" is tapped.
   * Desktop always shows every question (2-column grid). */
  mobilePreviewCount?: number;
}

/**
 * "Suggested Questions" — clickable cards that seed the conversation.
 * On mobile, only the first `mobilePreviewCount` show until expanded;
 * desktop always renders the full grid.
 */
export function SuggestedQuestions({
  questions,
  onSelect,
  mobilePreviewCount = 5,
}: SuggestedQuestionsProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = questions.length > mobilePreviewCount;

  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-teal">
        <SparkleIcon className="h-3.5 w-3.5" />
        Suggested Questions
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => onSelect(q)}
            className={`flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-4 text-left transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-50 ${
              !expanded && i >= mobilePreviewCount ? "hidden sm:flex" : "flex"
            }`}
          >
            <span>
              <span className="block text-sm font-bold text-brand-navy">{q.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{q.subtitle}</span>
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        ))}
      </div>

      {hasMore && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-teal sm:hidden"
        >
          Show more
          <ChevronRightIcon className="h-3.5 w-3.5 rotate-90" />
        </button>
      ) : null}
    </div>
  );
}
