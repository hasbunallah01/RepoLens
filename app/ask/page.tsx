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
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { QuestionPanel } from "@/components/ask/QuestionPanel";
import { RecentQuestions } from "@/components/ask/RecentQuestions";
import { RankingResults } from "@/components/ask/RankingResults";
import { QUESTION_EXAMPLES, RECENT_QUESTIONS } from "@/lib/ask/mock";
import {
  rankRelevantFiles,
  mockIndexedFiles,
  rankingCacheGet,
  rankingCacheSet,
  rankingCacheKey,
} from "@/lib/ranking";
import { cacheGet } from "@/lib/cache";
import type { RecentQuestion } from "@/types/question";
import type { RankResult } from "@/types/ranking";
import type { IndexedFile } from "@/types/repository";

/**
 * /ask — question interface + ranking visualization (Phase 3C2).
 *
 * - Renders QuestionPanel + RecentQuestions
 * - On submit, runs the local ranking engine (no AI, no Paritok)
 * - Displays ranked file cards with rank, score, path, and explanation
 * - Caches ranking results in sessionStorage for the current session
 */
export default function AskPage() {
  const [repoLabel, setRepoLabel] = useState<string | null>(null);
  const [echo, setEcho] = useState<string | null>(null);
  const [rankResult, setRankResult] = useState<RankResult | null>(null);
  const [ranking, setRanking] = useState(false);
  const [candidateFiles, setCandidateFiles] =
    useState<IndexedFile[]>(mockIndexedFiles);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const last = window.sessionStorage.getItem("repolens:lastRepo");
      if (last) {
        setRepoLabel(last);
        const cached = cacheGet(last);
        if (cached?.index?.files?.length) {
          setCandidateFiles(cached.index.files);
        }
      }
    } catch {
      // sessionStorage may be unavailable; ignore.
    }
  }, []);

  const runRanking = useCallback((question: string, files: IndexedFile[]) => {
    const key = rankingCacheKey(
      question,
      files.map((f) => f.path),
    );
    const cached = rankingCacheGet(key);
    if (cached) {
      setRankResult(cached);
      return;
    }

    setRanking(true);
    window.setTimeout(() => {
      const result = rankRelevantFiles(question, files, { limit: 10 });
      rankingCacheSet(key, result);
      setRankResult(result);
      setRanking(false);
    }, 120);
  }, []);

  const handleAsk = useCallback(
    (question: string) => {
      // eslint-disable-next-line no-console
      console.log("[RepoLens:ask]", { repo: repoLabel, question });
      setEcho(question);
      window.setTimeout(
        () => setEcho((current) => (current === question ? null : current)),
        3500,
      );
      runRanking(question, candidateFiles);
    },
    [repoLabel, candidateFiles, runRanking],
  );

  const handleSelectRecent = useCallback(
    (q: RecentQuestion) => {
      setRepoLabel(q.repo);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem("repolens:lastRepo", q.repo);
          const cached = cacheGet(q.repo);
          if (cached?.index?.files?.length) {
            setCandidateFiles(cached.index.files);
            runRanking(q.prompt, cached.index.files);
            return;
          }
        } catch {
          // ignore
        }
      }
      setCandidateFiles(mockIndexedFiles);
      runRanking(q.prompt, mockIndexedFiles);
      // eslint-disable-next-line no-console
      console.log("[RepoLens:ask:recent]", {
        id: q.id,
        prompt: q.prompt,
        repo: q.repo,
      });
    },
    [runRanking],
  );

  const examples = useMemo(() => QUESTION_EXAMPLES, []);

  return (
    <>
      <Section className="pt-12 md:pt-16">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900/60 px-3 py-1 text-xs font-medium text-navy-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Phase 3C2 · Ranking visualization
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Ask the repository, see ranked files.
            </h1>
            <p className="mt-4 text-sm text-navy-200 sm:text-base">
              Local ranking with transparent scores and explanations. No AI, no
              Paritok — just deterministic signals over file metadata.
            </p>
          </div>

          {echo ? (
            <div
              className="mx-auto mt-6 max-w-3xl rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
              role="status"
            >
              <span className="font-mono text-emerald-300">[ranked]</span>{" "}
              <span className="font-mono">{truncate(echo, 140)}</span>
            </div>
          ) : null}
        </Container>
      </Section>

      <Section compact className="border-t border-navy-800/60">
        <Container>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <QuestionPanel
                repoLabel={repoLabel}
                examples={examples}
                onAsk={handleAsk}
              />
              <RankingResults result={rankResult} loading={ranking} />
            </div>
            <div className="lg:col-span-1">
              <div className="sticky top-20 h-[calc(100vh-7rem)] min-h-[420px]">
                <RecentQuestions
                  questions={RECENT_QUESTIONS}
                  onSelect={handleSelectRecent}
                />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section compact className="border-t border-navy-800/60">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              How ranking works
            </h2>
            <p className="mt-2 text-sm text-navy-300">
              Each file is scored on filename match, folder relevance, path
              keywords, and extension fit. Scores are 0–100; explanations are
              generated from the same signals — never from a model.
            </p>
            <ol className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-2 text-left text-sm text-navy-200 sm:grid-cols-3">
              <Step n={1} label="You ask" desc="Type or pick a question." />
              <Step
                n={2}
                label="Rank locally"
                desc="Score files with deterministic signals."
              />
              <Step
                n={3}
                label="See why"
                desc="Rank, score, path, and short explanation."
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
