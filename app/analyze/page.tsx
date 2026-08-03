"use client";

import { useState } from "react";
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
import {
  MOCK_COMMITS,
  MOCK_EXTRA_STATS,
  MOCK_INDEXED_FILES,
  MOCK_LANGUAGES,
  MOCK_METADATA,
  MOCK_TREE,
} from "@/lib/mock-analyze-data";

type Stage = "idle" | "loading" | "done";

/**
 * /analyze — rebuilt to match the reference design.
 *
 * Everything below is driven by mock data shaped like the real
 * `AnalysisResult` type (see lib/mock-analyze-data.ts). The page owns a
 * simple idle -> loading -> done state machine so it *feels* fully wired;
 * swapping in the real `useRepoAnalysis` hook later is a matter of
 * replacing the mock objects with `data.metadata`, `data.index`, etc.
 * See the PR notes for the full list of backend gaps.
 */
export default function AnalyzePage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [repoInput, setRepoInput] = useState("");

  const startAnalysis = (url: string) => {
    setRepoInput(url);
    setStage("loading");
  };

  return (
    <>
      <Section className="pt-10 pb-6 md:pt-14">
        <Container>
          <AnalyzeHeader />
          <div className="mt-8">
            <RepositoryInput onSubmit={startAnalysis} disabled={stage === "loading"} initialValue={repoInput} />
            <ExampleRepositories onSelect={startAnalysis} disabled={stage === "loading"} />
          </div>
        </Container>
      </Section>

      {stage !== "idle" ? (
        <Section compact className="pt-0">
          <Container>
            <div className="space-y-6">
              {stage === "loading" ? (
                <AnalysisProgress onComplete={() => setStage("done")} />
              ) : null}

              {stage === "done" ? (
                <>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <RepositoryOverview
                      metadata={MOCK_METADATA}
                      totalFiles={MOCK_EXTRA_STATS.totalFiles}
                      totalDirectories={MOCK_EXTRA_STATS.totalDirectories}
                      linesOfCode={MOCK_EXTRA_STATS.linesOfCode}
                    />
                    <LanguageChart languages={MOCK_LANGUAGES} />
                    <RepositoryTree root={MOCK_TREE} />
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <RecentCommits commits={MOCK_COMMITS} />
                    <IndexedFiles files={MOCK_INDEXED_FILES} />
                  </div>

                  <BottomCTA />
                </>
              ) : null}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
