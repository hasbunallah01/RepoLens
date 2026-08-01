/**
 * /dev/paritok — dev-only mock page (Phases 4A, 4B, 5B).
 *
 * Runs the Paritok compression service end-to-end against the
 * mock auth repo and shows the result in the browser so the
 * developer can verify:
 *
 *   - the API key loaded from the environment,
 *   - the request reached Paritok,
 *   - the compressed response came back,
 *   - the GPU availability flag is reported,
 *   - the OpenAI service is wired in behind the compression
 *     pipeline and produces a grounded answer (Phase 5B).
 *
 * This page is **not** linked from the main navigation. It is
 * intended for local development only and will be removed (or
 * gated behind a feature flag) once the real ask pipeline
 * replaces it.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils";
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

/**
 * Phase 5B — UI state for the AI Answer card. The discriminated
 * shape mirrors the OpenAI service result so the card and the
 * network call stay trivially in sync.
 *
 *   - `idle`    — no compression has succeeded yet, or the user
 *                 re-ran compression and we are about to refetch.
 *   - `loading` — a request to `/api/dev/openai` is in flight.
 *   - `ok`      — the service returned a non-empty answer.
 *   - `error`   — the service failed (missing key, network,
 *                 upstream error, malformed response). The card
 *                 shows "Unable to generate answer" plus the
 *                 error message underneath.
 */
type AnswerStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; answer: string; model: string }
  | { kind: "error"; message: string };

/** Wire shape returned by POST /api/dev/openai on success. */
interface OpenAIApiSuccess {
  ok: true;
  data: { answer: string; model: string; usage?: unknown };
}

/** Wire shape returned by POST /api/dev/openai on failure. */
interface OpenAIApiFailure {
  ok: false;
  error: { code: string; message: string; status?: number };
}

type OpenAIApiResponse = OpenAIApiSuccess | OpenAIApiFailure;

const PREVIEW_LIMIT = 300;

export default function DevParitokPage() {
  const [state, setState] = useState<DevState>({ kind: "idle" });
  const [question, setQuestion] = useState("How does authentication work?");
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>({
    kind: "idle",
  });
  // Phase 5B — mirrors the OpenAI service. The card renders only
  // after compression succeeds, so the initial state is `idle`.
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>({
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
   * Phase 5B — forward the compressed context and the user's
   * question into the existing OpenAI service via the dev API
   * route. The route calls `generateAnswer()` server-side so the
   * API key never leaves the Node runtime.
   *
   * The compressed context we send is the *full* payload Paritok
   * returned (not the 300-char preview the card renders) so the
   * model sees the same information the pipeline produced.
   */
  const runAnswer = useCallback(async (compressed: string, q: string) => {
    setAnswerStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/dev/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: compressed, question: q }),
      });
      const body = (await res.json()) as OpenAIApiResponse;
      if (body.ok) {
        // eslint-disable-next-line no-console
        console.log("[dev/paritok] AI answer received:", body.data);
        setAnswerStatus({
          kind: "ok",
          answer: body.data.answer,
          model: body.data.model,
        });
      } else {
        // eslint-disable-next-line no-console
        console.error("[dev/paritok] OpenAI error:", body.error);
        setAnswerStatus({
          kind: "error",
          message: body.error.message,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[dev/paritok] network failure on /api/dev/openai:", err);
      setAnswerStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, []);

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
   * - 5B: on success, the full compressed payload is also forwarded
   *   to `runAnswer()` so the existing OpenAI service can produce
   *   a grounded answer. The previous AI Answer is cleared while
   *   the new request is in flight, and re-rendered when it
   *   completes (or as a failure card). On compression failure,
   *   the AI Answer state is reset to `idle`.
   */
  const runPipeline = useCallback(async () => {
    setPipelineLoading(true);
    setPipelineStatus({ kind: "idle" });
    setAnswerStatus({ kind: "idle" });
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
        // Phase 5B — fire the AI answer request now that we have a
        // compressed payload to ground the model on. We do not
        // await this; the card streams its own loading/ok/error
        // transitions and `runPipeline` returns to the caller as
        // soon as compression finishes.
        void runAnswer(full, question);
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
  }, [question, runAnswer]);

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
              <AIAnswerCard status={answerStatus} />
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

/**
 * Phase 5B + 5C — dev-style read-only card that shows the AI
 * answer produced by the existing OpenAI service. Placed directly
 * below the Compressed Context Preview, matching the same
 * developer aesthetic (rounded border, navy-950/60 background,
 * monospace caption, emerald accent).
 *
 * Rendering rules (per Phase 5B spec):
 *   - `idle`    — render nothing (compression is still running, or
 *                 has not yet produced a successful run).
 *   - `loading` — render a small "Generating answer…" placeholder
 *                 so the user sees that the second leg is in flight.
 *   - `ok`      — render the answer as **plain text only**. No
 *                 Markdown rendering, no syntax highlighting, no
 *                 smart formatting — just the model's text wrapped
 *                 in a `whitespace-pre-wrap` block so newlines
 *                 survive. Phase 5C adds a "Copy Answer" button in
 *                 the header that copies the raw text to the
 *                 clipboard and briefly shows a "✓ Copied"
 *                 confirmation for ~2 seconds.
 *   - `error`   — render "Unable to generate answer" with the
 *                 OpenAI service's error message underneath.
 */
function AIAnswerCard({ status }: { status: AnswerStatus }) {
  // Local UI state for the "✓ Copied" confirmation. We keep it
  // here (not lifted to the page) because the copy interaction
  // is purely a presentation concern of this card.
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always clear any pending "Copied" timer when the card unmounts
  // or when a new render schedules a new one. This prevents
  // "set state on unmounted component" warnings and stale flips
  // after the user navigates away.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (status.kind !== "ok") return;
    const text = status.answer;
    if (!text) return;

    // Use the modern Clipboard API when available (the dev page
    // runs over http://localhost which is a secure context, so
    // this is the common case). Fall back to a hidden textarea +
    // `execCommand("copy")` for older browsers / non-secure
    // contexts — the fallback is best-effort and never throws.
    let succeeded = false;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(text);
        succeeded = true;
      } else {
        succeeded = legacyCopy(text);
      }
    } catch {
      // The Clipboard API can reject (e.g. document not focused,
      // permissions blocked). Try the legacy path as a last
      // resort before giving up silently.
      succeeded = legacyCopy(text);
    }

    if (!succeeded) return;

    // Reset any in-flight timer so rapid clicks don't desync the
    // confirmation window.
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current);
    }
    setCopied(true);
    copyTimerRef.current = setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 2000);
  }, [status]);

  if (status.kind === "idle") return null;

  return (
    <div className="mt-8 rounded-lg border border-navy-800 bg-navy-950/60 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-200">
          AI Answer
        </h2>
        <div className="flex items-center gap-3">
          {status.kind === "ok" ? (
            <CopyButton copied={copied} onClick={() => void handleCopy()} />
          ) : null}
          <span className="text-[10px] uppercase tracking-wide text-navy-500">
            {status.kind === "ok" ? status.model : status.kind}
          </span>
        </div>
      </div>

      {status.kind === "loading" ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-xs text-navy-300"
        >
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          Generating answer…
        </div>
      ) : null}

      {status.kind === "ok" ? (
        // Plain text only. No Markdown, no HTML, no syntax
        // highlighting. Phase 5C improves readability:
        //   - `whitespace-pre-wrap` preserves the model's line
        //     breaks and intra-paragraph spacing exactly.
        //   - `break-words` (with `overflow-wrap-anywhere` as a
        //     safety net) wraps long lines so the card never
        //     produces a horizontal scrollbar.
        //   - Comfortable `leading-7`, slightly larger `text-[15px]`,
        //     and `p-5` padding give the prose room to breathe
        //     without making the card feel airy.
        <div
          data-testid="ai-answer-text"
          className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-md border border-navy-800 bg-navy-950 p-5 text-[15px] leading-7 tracking-[0.005em] text-navy-50"
        >
          {status.answer}
        </div>
      ) : null}

      {status.kind === "error" ? (
        <div
          role="status"
          className="rounded-md border border-rose-700/40 bg-rose-900/20 p-3"
        >
          <p className="text-sm font-medium text-rose-200">
            Unable to generate answer
          </p>
          {status.message ? (
            <p className="mt-1 text-xs text-rose-100/80">{status.message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Phase 5C — compact "Copy Answer" button rendered inside the
 * AIAnswerCard header. When clicked, it copies the answer to the
 * clipboard (handled by the parent) and flips its label to
 * "✓ Copied" for ~2 seconds before reverting. The button is
 * purely presentational; it never reads the answer itself.
 */
function CopyButton({
  copied,
  onClick,
}: {
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      aria-label={copied ? "Answer copied to clipboard" : "Copy answer to clipboard"}
      data-testid="ai-answer-copy"
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium uppercase tracking-wider transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
        copied
          ? "border-emerald-700/50 bg-emerald-900/30 text-emerald-300"
          : "border-navy-700 bg-navy-900/60 text-navy-200 hover:border-emerald-500/50 hover:bg-navy-900 hover:text-white",
      )}
    >
      {copied ? (
        <>
          <CheckIcon className="h-3.5 w-3.5" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <CopyIcon className="h-3.5 w-3.5" />
          <span>Copy Answer</span>
        </>
      )}
    </button>
  );
}

/**
 * Phase 5C — best-effort legacy clipboard copy using a hidden
 * textarea and the deprecated `document.execCommand("copy")`.
 * Used only when the modern Clipboard API is unavailable or
 * rejects. Returns `true` on success, `false` otherwise.
 */
function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="m5 12 5 5L20 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
