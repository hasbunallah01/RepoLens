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

type PipelineStatus =
  | { kind: "idle" }
  | {
      kind: "ok";
      preview: string;
      truncated: boolean;
      originalSize: number;
      compressedSize: number;
    }
  | { kind: "error"; message: string };

const PREVIEW_LIMIT = 300;

export default function DevParitokPage() {
  const [state, setState] = useState<DevState>({ kind: "idle" });
  const [question, setQuestion] = useState("How does authentication work?");
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>({
    kind: "idle",
  });

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
   * Phase 4B2a/4B2b/4B2c/4B3a — invokes the existing `compressContext()`
   * pipeline directly (rank → Context Builder → Paritok).
   *
   * - 4B2b: button is disabled while the pipeline runs and shows a
   *   "Compressing..." spinner.
   * - 4B2c: a small success/failure badge is rendered next to the
   *   button when the request finishes. The previous badge is
   *   cleared when a new request starts.
   * - 4B3a: on success, the first 300 chars of the compressed content
   *   are stored in the status and rendered as a read-only dev-style
   *   "Compressed Context Preview" card. The full response is never
   *   shown.
   */
  const runPipeline = useCallback(async () => {
    setPipelineLoading(true);
    setPipelineStatus({ kind: "idle" });
    try {
      const { ranked } = rankRelevantFiles(question, mockIndexedFiles, {
        limit: 5,
      });
      const result = await compressContext(
        question,
        ranked,
        mockRepository,
        {
          contentSource: "inline",
          contents: mockFileContents,
          limit: 5,
        },
      );
      if (result.compressed.ok) {
        const full = result.compressed.data.compressed;
        const truncated = full.length > PREVIEW_LIMIT;
        // Phase 4B3b — original context size is the joined `content`
        // field of every file in the Context Package returned by the
        // builder. The compressed size is the length of the payload
        // Paritok gave us back. Both numbers come straight from the
        // existing pipeline result — no recomputation.
        const originalSize = result.package.files.reduce(
          (acc, f) => acc + f.content.length,
          0,
        );
        const compressedSize = full.length;
        setPipelineStatus({
          kind: "ok",
          preview: truncated
            ? `${full.slice(0, PREVIEW_LIMIT)}...`
            : full,
          truncated,
          originalSize,
          compressedSize,
        });
      } else {
        setPipelineStatus({
          kind: "error",
          message: result.compressed.error.message,
        });
      }
    } catch (err) {
      setPipelineStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
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
              <CompressionStatus status={pipelineStatus} />
              <span className="text-xs text-navy-400">
                Endpoint:&nbsp;
                <code className="text-navy-200">
                  https://www.paritok.com/api/compress
                </code>
              </span>
            </div>
          </div>

          {pipelineStatus.kind === "ok" ? (
            <>
              <ContextSizeComparison
                originalSize={pipelineStatus.originalSize}
                compressedSize={pipelineStatus.compressedSize}
              />
              <CompressedContextPreview
                preview={pipelineStatus.preview}
                truncated={pipelineStatus.truncated}
              />
            </>
          ) : null}

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

/**
 * Phase 4B2c — minimal visual feedback for the "Compress with Paritok"
 * pipeline. Renders nothing until the pipeline finishes; then either a
 * green "Compression completed" badge or a red "Compression failed"
 * badge appears below the button. If the pipeline surfaced an error
 * message, it is rendered underneath in small muted text. The
 * compressed payload and any token statistics are deliberately never
 * shown here.
 */
function CompressionStatus({ status }: { status: PipelineStatus }) {
  if (status.kind === "idle") return null;

  if (status.kind === "ok") {
    return (
      <span
        role="status"
        className="inline-flex items-center rounded-full border border-emerald-700/40 bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-300"
      >
        ✓ Compression completed
      </span>
    );
  }

  return (
    <span
      role="status"
      className="inline-flex flex-col items-start gap-1"
    >
      <span className="inline-flex items-center rounded-full border border-rose-700/40 bg-rose-900/30 px-2.5 py-0.5 text-xs font-medium text-rose-300">
        ✗ Compression failed
      </span>
      {status.message ? (
        <span className="text-xs text-navy-400">{status.message}</span>
      ) : null}
    </span>
  );
}

/**
 * Phase 4B3b — simple information card showing the original context
 * size and the compressed context size, both in characters. Only
 * rendered after a successful compression. No tokens, no
 * percentages, no OpenAI.
 */
function ContextSizeComparison({
  originalSize,
  compressedSize,
}: {
  originalSize: number;
  compressedSize: number;
}) {
  return (
    <div className="mt-8 rounded-lg border border-navy-800 bg-navy-950/60 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-200">
          Context Size Comparison
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-navy-500">
          characters
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy-400">
            Original Context Size
          </dt>
          <dd className="mt-1 font-mono text-navy-50">
            {originalSize.toLocaleString()} characters
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-navy-400">
            Compressed Context Size
          </dt>
          <dd className="mt-1 font-mono text-navy-50">
            {compressedSize.toLocaleString()} characters
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Phase 4B3a — dev-style read-only card showing the first 300
 * characters of the compressed content returned by Paritok. Only
 * rendered after a successful compression (and cleared on the next
 * run). The full response and any token statistics are deliberately
 * never shown.
 */
function CompressedContextPreview({
  preview,
  truncated,
}: {
  preview: string;
  truncated: boolean;
}) {
  return (
    <div className="mt-8 rounded-lg border border-navy-800 bg-navy-950/60 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-200">
          Compressed Context Preview
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-navy-500">
          {truncated ? "first 300 chars" : "full payload"}
        </span>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-navy-800 bg-navy-950 p-3 font-mono text-xs leading-relaxed text-navy-100">
        {preview}
      </pre>
    </div>
  );
}
