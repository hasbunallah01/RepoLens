/**
 * /dev/paritok — dev-only mock page (Phase 4A).
 *
 * Runs the Paritok compression service end-to-end against the
 * mock auth repo and shows the result in the browser so the
 * developer can verify:
 *
 *   - the API key loaded from the environment,
 *   - the request reached Paritok,
 *   - the compressed response came back,
 *   - the GPU availability flag is reported.
 *
 * This page is **not** linked from the main navigation. It is
 * intended for local development only and will be removed (or
 * gated behind a feature flag) in Phase 4B once the real
 * ask pipeline replaces it.
 */

"use client";

import { useCallback, useState } from "react";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { Button } from "@/components/Button";
import { compressContext } from "@/lib/pipeline";
import { rankRelevantFiles } from "@/lib/ranking";
import {
  mockFileContents,
  mockIndexedFiles,
  mockRepository,
} from "@/lib/context/mock";
import type {
  ParitokCompressionResult,
  ParitokError,
} from "@/lib/paritok";

type DevState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; result: ParitokCompressionResult; meta: DevMeta }
  | { kind: "error"; error: ParitokError; meta?: DevMeta };

interface DevMeta {
  question: string;
  fileCount: number;
  filePaths: string[];
  builtAt: string;
}

interface DevApiSuccess {
  ok: true;
  data: ParitokCompressionResult;
  package: DevMeta;
}

interface DevApiFailure {
  ok: false;
  error: ParitokError;
}

type DevApiResponse = DevApiSuccess | DevApiFailure;

export default function DevParitokPage() {
  const [state, setState] = useState<DevState>({ kind: "idle" });
  const [question, setQuestion] = useState("How does authentication work?");
  const [pipelineLoading, setPipelineLoading] = useState(false);

  const run = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/dev/paritok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = (await res.json()) as DevApiResponse;
      if (body.ok) {
        // eslint-disable-next-line no-console
        console.log("[dev/paritok] compressed response:", body.data);
        setState({ kind: "ok", result: body.data, meta: body.package });
      } else {
        // eslint-disable-next-line no-console
        console.error("[dev/paritok] Paritok error:", body.error);
        setState({ kind: "error", error: body.error });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // eslint-disable-next-line no-console
      console.error("[dev/paritok] network failure:", err);
      setState({
        kind: "error",
        error: { code: "NETWORK", message },
      });
    }
  }, [question]);

  /**
   * Phase 4B2a/4B2b — invokes the existing `compressContext()` pipeline
   * directly (rank → Context Builder → Paritok). Phase 4B2b adds a
   * loading state: while the pipeline is running, the button is
   * disabled, the text changes to "Compressing…", and a spinner is
   * shown. No success/failure UI, no compressed-data display.
   */
  const runPipeline = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const { ranked } = rankRelevantFiles(question, mockIndexedFiles, {
        limit: 5,
      });
      await compressContext(question, ranked, mockRepository, {
        contentSource: "inline",
        contents: mockFileContents,
        limit: 5,
      });
    } finally {
      setPipelineLoading(false);
    }
  }, [question]);

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-navy-50 sm:text-4xl">
            Dev · Paritok Compression
          </h1>
          <p className="mt-4 text-navy-200">
            Phase 4A mock page. Sends a Context Package built from the
            mock auth repo to Paritok and shows the compressed output.
            For local development only — not linked from the main
            navigation.
          </p>

          <div className="mt-8 space-y-4 rounded-lg border border-navy-800 bg-navy-900/50 p-6">
            <label
              htmlFor="paritok-question"
              className="block text-sm font-medium text-navy-100"
            >
              Question (mocked)
            </label>
            <input
              id="paritok-question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-md border border-navy-700 bg-navy-950 px-3 py-2 text-navy-50 outline-none focus:border-emerald-500"
            />

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={run}
                disabled={state.kind === "loading"}
              >
                {state.kind === "loading" ? "Compressing…" : "Run Paritok"}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void runPipeline()}
                disabled={pipelineLoading}
              >
                {pipelineLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                    Compressing...
                  </span>
                ) : (
                  "Compress with Paritok"
                )}
              </Button>
              <span className="text-xs text-navy-400">
                Endpoint:&nbsp;
                <code className="text-navy-200">
                  https://www.paritok.com/api/compress
                </code>
              </span>
            </div>
          </div>

          <div className="mt-8">
            {state.kind === "idle" && (
              <p className="text-navy-400">
                Click <em>Run Paritok</em> to compress the mock Context
                Package. The full response is also logged to the browser
                console.
              </p>
            )}

            {state.kind === "loading" && (
              <p className="text-navy-300">Sending request…</p>
            )}

            {state.kind === "ok" && (
              <ResultView result={state.result} meta={state.meta} />
            )}

            {state.kind === "error" && <ErrorView error={state.error} />}
          </div>
        </div>
      </Container>
    </Section>
  );
}

function ResultView({
  result,
  meta,
}: {
  result: ParitokCompressionResult;
  meta: DevMeta;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 p-4">
        <h2 className="text-lg font-semibold text-emerald-300">
          ✓ Compressed response received
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Field label="Files in package" value={String(meta.fileCount)} />
          <Field
            label="GPU available"
            value={result.gpu_available ? "yes" : "no"}
          />
          <Field
            label="Compressed length"
            value={`${result.compressed.length} chars`}
          />
          <Field
            label="Client id"
            value={result.clientId ?? "—"}
          />
        </dl>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-300">
          Files sent
        </h3>
        <ul className="mt-2 list-inside list-disc text-sm text-navy-200">
          {meta.filePaths.map((p) => (
            <li key={p}>
              <code className="text-navy-100">{p}</code>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-300">
          Compressed output
        </h3>
        <pre className="mt-2 max-h-[480px] overflow-auto rounded-md border border-navy-800 bg-navy-950 p-4 text-xs text-navy-100">
          {result.compressed}
        </pre>
      </div>
    </div>
  );
}

function ErrorView({ error }: { error: ParitokError }) {
  const isMissingKey = error.code === "MISSING_API_KEY";
  return (
    <div className="rounded-lg border border-rose-700/40 bg-rose-900/20 p-4">
      <h2 className="text-lg font-semibold text-rose-300">
        ✗ Paritok call failed
      </h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Field label="Code" value={error.code} />
        {error.status !== undefined && (
          <Field label="HTTP status" value={String(error.status)} />
        )}
      </dl>
      <p className="mt-3 text-sm text-rose-100">{error.message}</p>
      {isMissingKey && (
        <p className="mt-3 text-xs text-navy-200">
          Add <code className="text-navy-50">PARITOK_API_KEY</code> to your{" "}
          <code className="text-navy-50">.env.local</code> and restart the
          dev server.
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-navy-400">
        {label}
      </dt>
      <dd className="mt-1 text-navy-50">
        <code>{value}</code>
      </dd>
    </div>
  );
}
