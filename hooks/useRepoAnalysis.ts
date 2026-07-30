"use client";

/**
 * `useRepoAnalysis` — drives the analyze flow.
 *
 * Responsibilities:
 *   - validate the URL client-side (cheap, instant feedback)
 *   - call /api/analyze
 *   - keep the latest result in a session-scoped cache
 *   - expose `loading`, `error`, `data`, `analyze`, `reset`
 *
 * Intentionally not a context: a single page owns it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { parseGitHubUrl } from "@/lib/github/parse-url";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { AnalysisError, AnalysisResult, RepoMetadata } from "@/types/repository";

interface UseRepoAnalysisState {
  loading: boolean;
  data: AnalysisResult | null;
  error: AnalysisError | null;
  /** Last successfully analyzed repo (kept even after a new error). */
  lastRepo: RepoMetadata | null;
}

interface UseRepoAnalysis extends UseRepoAnalysisState {
  analyze: (url: string) => Promise<void>;
  reset: () => void;
  /** Pulls a cached result by full name without a network call. */
  loadCached: (fullName: string) => boolean;
}

type ApiResponse =
  | { ok: true; data: AnalysisResult }
  | { ok: false; error: AnalysisError };

export function useRepoAnalysis(): UseRepoAnalysis {
  const [state, setState] = useState<UseRepoAnalysisState>({
    loading: false,
    data: null,
    error: null,
    lastRepo: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  // Abort in-flight request on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const analyze = useCallback(async (url: string) => {
    const parsed = parseGitHubUrl(url);
    if (!parsed.ok) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: { code: "INVALID_URL", message: parsed.reason },
      }));
      return;
    }

    // Cache hit?
    const fullName = `${parsed.value.owner}/${parsed.value.repo}`;
    const cached = cacheGet(fullName);
    if (cached) {
      setState({
        loading: false,
        data: cached,
        error: null,
        lastRepo: cached.metadata,
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(
        `/api/analyze?url=${encodeURIComponent(parsed.value.raw)}`,
        { signal: controller.signal, cache: "no-store" },
      );
      const body = (await res.json()) as ApiResponse;
      if (!body.ok) {
        setState((prev) => ({ ...prev, loading: false, error: body.error }));
        return;
      }
      cacheSet(body.data);
      setState({
        loading: false,
        data: body.data,
        error: null,
        lastRepo: body.data.metadata,
      });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: {
          code: "NETWORK",
          message:
            err instanceof Error
              ? `Network error: ${err.message}`
              : "Network error. Please try again.",
        },
      }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ loading: false, data: null, error: null, lastRepo: null });
  }, []);

  const loadCached = useCallback((fullName: string) => {
    const cached = cacheGet(fullName);
    if (!cached) return false;
    setState({
      loading: false,
      data: cached,
      error: null,
      lastRepo: cached.metadata,
    });
    return true;
  }, []);

  return { ...state, analyze, reset, loadCached };
}
