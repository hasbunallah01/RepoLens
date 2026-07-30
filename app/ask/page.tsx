"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { QuestionPanel } from "@/components/ask/QuestionPanel";
import { RecentQuestions } from "@/components/ask/RecentQuestions";
import { QUESTION_EXAMPLES, RECENT_QUESTIONS } from "@/lib/ask/mock";
import type { RecentQuestion } from "@/types/question";

/**
 * /ask — the question interface (Phase 3A).
 *
 * - Renders the QuestionPanel + RecentQuestions side by side
 * - On submit, logs the question to the console and prepends a transient
 *   "Echoed" line so the user gets visible feedback in the browser too
 * - No AI, no retrieval, no Paritok — those land in Phase 3B / 3C
 */
export default function AskPage() {
  // The most recent repository the user analyzed (kept in sessionStorage so
  // navigating away and back still works). Phase 3B will replace this with
  // a real context derived from the analysis result.
  const [repoLabel, setRepoLabel] = useState<string | null>(null);
  const [echo, setEcho] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const last = window.sessionStorage.getItem("repolens:lastRepo");
      if (last) setRepoLabel(last);
    } catch {
      // sessionStorage may be unavailable (e.g. private mode); ignore.
    }
  }, []);

  const handleAsk = useCallback(
    (question: string) => {
      // The only side-effect required by the Phase 3A spec.
      // eslint-disable-next-line no-console
      console.log("[RepoLens:ask]", { repo: repoLabel, question });
      setEcho(question);
      // Clear the echo after a moment so it feels ephemeral.
      window.setTimeout(() => setEcho((current) => (current === question ? null : current)), 3500);
    },
    [repoLabel],
  );

  const handleSelectRecent = useCallback((q: RecentQuestion) => {
    setRepoLabel(q.repo);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem("repolens:lastRepo", q.repo);
      } catch {
        // ignore
      }
    }
    // For Phase 3A we just log; the real "re-ask" flow will fill the
    // textarea in Phase 3B once the panel accepts an external value.
    // eslint-disable-next-line no-console
    console.log("[RepoLens:ask:recent]", { id: q.id, prompt: q.prompt, repo: q.repo });
  }, []);

  const examples = useMemo(() => QUESTION_EXAMPLES, []);

  return (
    <>
      <Section className="pt-12 md:pt-16">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900/60 px-3 py-1 text-xs font-medium text-navy-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Phase 3A · Question interface
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Ask the repository, get a grounded answer.
            </h1>
            <p className="mt-4 text-sm text-navy-200 sm:text-base">
              A focused, developer-first surface for asking questions about a codebase. For now,
              submissions are echoed to the browser console only — Paritok-optimised AI answers
              arrive in Phase 3B.
            </p>
          </div>

          {echo ? (
            <div
              className="mx-auto mt-6 max-w-3xl rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
              role="status"
            >
              <span className="font-mono text-emerald-300">[console]</span>{" "}
              <span className="font-mono">{truncate(echo, 140)}</span>
            </div>
          ) : null}
        </Container>
      </Section>

      <Section compact className="border-t border-navy-800/60">
        <Container>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <QuestionPanel repoLabel={repoLabel} examples={examples} onAsk={handleAsk} />
            </div>
            <div className="lg:col-span-1">
              <div className="sticky top-20 h-[calc(100vh-7rem)] min-h-[420px]">
                <RecentQuestions questions={RECENT_QUESTIONS} onSelect={handleSelectRecent} />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section compact className="border-t border-navy-800/60">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              What happens after you ask?
            </h2>
            <p className="mt-2 text-sm text-navy-300">
              In Phase 3B, your question will be paired with a Paritok-optimised slice of the
              codebase and sent to the model. For now, you can verify the wiring by opening the
              browser console.
            </p>
            <ol className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-2 text-left text-sm text-navy-200 sm:grid-cols-3">
              <Step n={1} label="You ask" desc="Type or pick a question." />
              <Step
                n={2}
                label="RepoLens reads"
                desc="(Phase 3B) Retrieve only the relevant files."
              />
              <Step
                n={3}
                label="Paritok shrinks"
                desc="(Phase 3B) Token-efficient context for the model."
              />
            </ol>
          </div>
        </Container>
      </Section>
    </>
  );
}

function Step({ n, label, desc }: { n: number; label: string; desc: string }) {
  return (
    <li className="rounded-lg border border-navy-800/60 bg-navy-900/30 p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-xs text-emerald-300 ring-1 ring-emerald-500/30">
          {n}
        </span>
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <p className="mt-1.5 text-xs text-navy-300">{desc}</p>
    </li>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}
