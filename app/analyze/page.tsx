"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { RepoUrlInput } from "@/components/analyze/RepoUrlInput";
import { RepoHeader } from "@/components/analyze/RepoHeader";
import { StatsGrid } from "@/components/analyze/StatsGrid";
import { LanguageBreakdown } from "@/components/analyze/LanguageBreakdown";
import { RepoTree } from "@/components/analyze/RepoTree";
import { RepoSearch } from "@/components/analyze/RepoSearch";
import { ResultSkeleton } from "@/components/analyze/ResultSkeleton";
import { ErrorBanner } from "@/components/analyze/ErrorBanner";
import { useRepoAnalysis } from "@/hooks/useRepoAnalysis";

export default function AnalyzePage() {
  const { analyze, loading, data, error, reset, lastRepo } = useRepoAnalysis();
  const [url, setUrl] = useState("");

  useEffect(() => {
    // No-op: reserved for future deep-link param (?url=...)
  }, []);

  return (
    <>
      <Section className="pt-12 md:pt-16">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-navy-700 bg-navy-900/60 px-3 py-1 text-xs font-medium text-navy-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Phase 2 · Repository Engine
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Look inside any GitHub repository.
            </h1>
            <p className="mt-4 text-sm text-navy-200 sm:text-base">
              Paste a public repository URL. RepoLens fetches the metadata,
              walks the file tree, builds a searchable index, and prepares the
              codebase for AI Q&amp;A in Phase 3.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <RepoUrlInput
              onAnalyze={(value) => {
                setUrl(value);
                void analyze(value);
              }}
              loading={loading}
              defaultValue={url}
              serverError={error?.code && error.code !== "INVALID_URL" ? error.message : null}
            />
          </div>
        </Container>
      </Section>

      <Section compact className="border-t border-navy-800/60">
        <Container>
          {loading ? (
            <ResultSkeleton />
          ) : error ? (
            <div className="space-y-4">
              <ErrorBanner error={error} />
              {lastRepo ? (
                <p className="text-xs text-navy-400">
                  Last successful analysis:{" "}
                  <button
                    type="button"
                    onClick={() => void analyze(lastRepo.htmlUrl)}
                    className="text-emerald-400 hover:underline"
                  >
                    retry {lastRepo.fullName}
                  </button>
                </p>
              ) : null}
            </div>
          ) : data ? (
            <div className="space-y-6">
              <RepoHeader metadata={data.metadata} totalFiles={data.index.totalFiles} />
              <StatsGrid
                metadata={data.metadata}
                index={data.index}
                commits={data.commits}
              />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <LanguageBreakdown languages={data.index.languages} />
                <RepoSearch
                  files={data.index.files}
                  extensions={data.index.extensions}
                />
              </div>
              <RepoTree root={data.index.tree} totalFiles={data.index.totalFiles} />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-navy-400">
                <span>
                  Indexed {new Date(data.fetchedAt).toLocaleString()} ·{" "}
                  {data.index.totalFiles.toLocaleString()} files ·{" "}
                  {formatBytes(data.index.totalSizeBytes)}
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md border border-navy-700 px-2.5 py-1 text-navy-200 hover:border-emerald-500/40 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </Container>
      </Section>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-navy-700/80 bg-navy-900/20 p-10 text-center">
      <h2 className="text-lg font-semibold text-white">No repository loaded yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-navy-300">
        Paste a GitHub URL above to see the repo header, statistics, language
        breakdown, file tree, and a searchable index.
      </p>
      <ul className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-2 text-left text-sm text-navy-300 sm:grid-cols-2">
        <Hint>✓ Works with any public GitHub repository</Hint>
        <Hint>✓ Fetches metadata, file tree, recent commits</Hint>
        <Hint>✓ Filters out binaries, lockfiles, and build output</Hint>
        <Hint>✓ Local, instant search across indexed files</Hint>
      </ul>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-md border border-navy-800/60 bg-navy-950/40 px-3 py-2">{children}</li>
  );
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = n;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
