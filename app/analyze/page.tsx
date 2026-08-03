"use client";

import { useCallback, useState } from "react";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { AnalyzeHeader } from "@/components/analyze/AnalyzeHeader";
import { RepositoryInput } from "@/components/analyze/RepositoryInput";
import { ExampleRepositories } from "@/components/analyze/ExampleRepositories";
import { AnalysisProgress } from "@/components/analyze/AnalysisProgress";
import { RepositoryOverview } from "@/components/analyze/RepositoryOverview";
import { LanguageChart } from "@/components/analyze/LanguageChart";
import { RepositoryTree } from "@/components/analyze/RepositoryTree";
import { RecentCommits } from "@/components/analyze/RecentCommits";
import { IndexedFiles } from "@/components/analyze/IndexedFiles";
import { BottomCTA } from "@/components/analyze/BottomCTA";
import { useRepoAnalysis } from "@/hooks/useRepoAnalysis";
import {
  formatLinesOfCode,
  topLanguages,
} from "@/lib/mock-analyze-data";
import type { AnalysisError } from "@/types/repository";

type Stage = "idle" | "loading" | "done" | "error";

/**
 * /analyze — wired to the real `/api/analyze` backend.
 *
 * State machine:
 *
 *   idle
 *     └─ user submits URL ─► loading
 *                                ├─ response received
 *                                │     ├─ ok      ─► done
 *                                │     └─ error   ─► error
 *                                └─ cache hit (immediate) ─► done
 *
 * The page is the only consumer of `useRepoAnalysis`, so the hook's
 * session-scoped cache (see `lib/cache.ts`) survives route changes
 * in the same browser session without a network round trip. UI
 * layout, copy, and component structure are unchanged from the
 * approved design — only the data source moved from
 * `lib/mock-analyze-data.ts` (mocked Next.js repo) to the live
 * backend response.
 */
export default function AnalyzePage() {
  const { loading, data, error, analyze } = useRepoAnalysis();
  const [stage, setStage] = useState<Stage>("idle");
  const [repoInput, setRepoInput] = useState("");

  const startAnalysis = useCallback(
    (url: string) => {
      setRepoInput(url);
      setStage("loading");
      // Fire-and-forget: the hook's own `loading` flag drives the
      // progress simulation, and the resolved data/error drives the
      // transition to "done"/"error" via the `completed` prop.
      void analyze(url);
    },
    [analyze],
  );

  // The simulated progress is allowed to finish only when we have
  // something to show (data or an error). This is what stops the
  // page from racing ahead of the network and flashing an empty
  // "done" state.
  const analysisFinished = !loading && (data !== null || error !== null);

  return (
    <>
      <Section className="pt-10 pb-6 md:pt-14">
        <Container>
          <AnalyzeHeader />
          <div className="mt-8">
            <RepositoryInput
              onSubmit={startAnalysis}
              disabled={stage === "loading"}
              initialValue={repoInput}
            />
            <ExampleRepositories
              onSelect={startAnalysis}
              disabled={stage === "loading"}
            />
          </div>
        </Container>
      </Section>

      {stage !== "idle" ? (
        <Section compact className="pt-0">
          <Container>
            <div className="space-y-6">
              {stage === "loading" ? (
                <AnalysisProgress
                  onComplete={() => setStage(error ? "error" : "done")}
                  totalFiles={data?.index.totalFiles}
                  completed={analysisFinished}
                />
              ) : null}

              {stage === "done" && data ? (
                <>
                  <AnalysisMetadata data={data} />
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <RepositoryOverview
                      metadata={data.metadata}
                      totalFiles={data.index.totalFiles}
                      totalDirectories={data.index.directoryCount}
                      linesOfCode={formatLinesOfCode(data.linesOfCode)}
                    />
                    <LanguageChart languages={topLanguages(data.index.languages)} />
                    <RepositoryTree root={data.index.tree} />
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <RecentCommits commits={data.commits} />
                    <IndexedFiles files={data.index.files.slice(0, 12)} />
                  </div>

                  <BottomCTA href={`/ask?repo=${encodeURIComponent(data.metadata.fullName)}`} />
                </>
              ) : null}

              {stage === "error" && error ? (
                <ErrorCard error={error} onRetry={() => startAnalysis(repoInput)} />
              ) : null}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function AnalysisMetadata({ data }: { data: import("@/types/repository").AnalysisResult }) {
  const durationSec = (data.analysisDurationMs / 1000).toFixed(2);
  const analyzedAt = new Date(data.analyzedAt);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-5 py-3 text-xs text-slate-500 shadow-sm shadow-slate-100 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Analysis completed in <strong className="font-semibold text-brand-navy">{durationSec}s</strong>
      </span>
      <span title={analyzedAt.toISOString()}>
        Analyzed at {analyzedAt.toLocaleString()}
      </span>
    </div>
  );
}

function ErrorCard({ error, onRetry }: { error: AnalysisError; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
      <h3 className="text-base font-bold text-red-700">Analysis failed</h3>
      <p className="mt-1 text-sm text-red-600">{error.message}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-red-400">
        Code: {error.code}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  );
}
