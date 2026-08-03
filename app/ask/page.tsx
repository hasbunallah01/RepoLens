"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { Button } from "@/components/Button";
import { AskRepoSummary } from "@/components/ask/AskRepoSummary";
import { AskGreeting } from "@/components/ask/AskGreeting";
import { ConversationPanel, type ChatMessage } from "@/components/ask/ConversationPanel";
import { RepositoryContextCard } from "@/components/ask/RepositoryContextCard";
import { TopFilesCard } from "@/components/ask/TopFilesCard";
import { TipsCard } from "@/components/ask/TipsCard";
import { RobotIcon, SearchIcon, XCircleIcon } from "@/components/icons";
import { useRepoAnalysis } from "@/hooks/useRepoAnalysis";
import { SUGGESTED_QUESTIONS } from "@/lib/mock-ask-data";
import type { SuggestedQuestion } from "@/lib/mock-ask-data";
import type { AnalysisError } from "@/types/repository";

type MobileTab = "chat" | "context";

/** Shape of a successful `/api/ask` response (see `app/api/ask/route.ts`). */
interface AskApiSuccess {
  ok: true;
  data: {
    answer: { text: string; model: string };
    referencedFiles: string[];
  };
}
interface AskApiFailure {
  ok: false;
  error: AnalysisError;
}
type AskApiResponse = AskApiSuccess | AskApiFailure;

/**
 * /ask — wired to the real backend.
 *
 * The active repository comes only from the `?repo=owner/repo` URL
 * parameter set by the Analyze page's "Ask about this repository" CTA.
 * No localStorage, no auth, no history — those are later milestones.
 *
 * Repository identity/metadata reuses the existing `/api/analyze`
 * route (via `useRepoAnalysis`, the same hook the Analyze page uses)
 * -- that route is analysis-only. Each question is sent to the
 * dedicated `POST /api/ask` route, which reuses the existing
 * ranking -> context builder -> Paritok -> OpenAI pipeline.
 */
export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <AskPageContent />
    </Suspense>
  );
}

function AskPageContent() {
  const searchParams = useSearchParams();
  const repo = (searchParams.get("repo") ?? "").trim();

  const { loading, data, error, analyze } = useRepoAnalysis();
  const requestedRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!repo || requestedRef.current === repo) return;
    requestedRef.current = repo;
    void analyze(repo);
  }, [repo, analyze]);

  const appendExchange = useCallback(
    (userText: string) => {
      const trimmed = userText.trim();
      // Guard against duplicate/overlapping submissions while a
      // previous question is still in flight.
      if (!trimmed || sending || !repo) return;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
      const pendingId = crypto.randomUUID();
      const pendingMsg: ChatMessage = { id: pendingId, role: "assistant", text: "", pending: true };
      setMessages((prev) => [...prev, userMsg, pendingMsg]);
      setSending(true);

      void (async () => {
        try {
          const res = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repository: repo, question: trimmed }),
            cache: "no-store",
          });
          const body = (await res.json()) as AskApiResponse;

          if (!body.ok) {
            const message = body.error.message || "Something went wrong answering that question.";
            setMessages((prev) =>
              prev.map((m): ChatMessage =>
                m.id === pendingId ? { id: pendingId, role: "assistant", text: message, isError: true } : m,
              ),
            );
            return;
          }

          const answerText = body.data.answer.text.trim() || "The backend didn't return an answer for that question.";
          const referencedFiles = body.data.referencedFiles;

          setMessages((prev) =>
            prev.map((m): ChatMessage =>
              m.id === pendingId
                ? { id: pendingId, role: "assistant", text: answerText, referencedFiles }
                : m,
            ),
          );
        } catch (err) {
          const message =
            err instanceof Error ? `Network error: ${err.message}` : "Network error. Please try again.";
          setMessages((prev) =>
            prev.map((m): ChatMessage =>
              m.id === pendingId ? { id: pendingId, role: "assistant", text: message, isError: true } : m,
            ),
          );
        } finally {
          setSending(false);
        }
      })();
    },
    [repo, sending],
  );

  const handleSelectQuestion = (q: SuggestedQuestion) => appendExchange(q.title);
  const retryRepoLoad = useCallback(() => {
    requestedRef.current = null;
    void analyze(repo);
  }, [analyze, repo]);

  if (!repo) {
    return <EmptyState />;
  }

  if (!data && loading) {
    return <LoadingState repo={repo} />;
  }

  if (!data && error) {
    return <ErrorState repo={repo} error={error} onRetry={retryRepoLoad} />;
  }

  if (!data) {
    // Defensive fallback -- should not be reachable given the branches
    // above, but keeps the component total for TypeScript.
    return <LoadingState repo={repo} />;
  }

  return (
    <Section className="pt-6 pb-12 md:pt-8">
      <Container>
        <div className="space-y-6">
          <AskRepoSummary metadata={data.metadata} />

          {/* Mobile tab switcher — desktop always shows both columns */}
          <div className="flex gap-6 border-b border-slate-100 lg:hidden">
            <TabButton label="Chat" active={mobileTab === "chat"} onClick={() => setMobileTab("chat")} />
            <TabButton label="Context" active={mobileTab === "context"} onClick={() => setMobileTab("context")} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className={`space-y-4 lg:col-span-2 ${mobileTab === "context" ? "hidden lg:block" : ""}`}>
              <AskGreeting questions={SUGGESTED_QUESTIONS} onSelectQuestion={handleSelectQuestion} />
              <ConversationPanel messages={messages} onSend={appendExchange} disabled={sending} />
            </div>

            <div className={`space-y-4 lg:col-span-1 ${mobileTab === "chat" ? "hidden lg:block" : ""}`}>
              <RepositoryContextCard />
              <TopFilesCard />
              <TipsCard />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
        active ? "border-brand-teal text-brand-teal" : "border-transparent text-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Non-idle states                                                            */
/* -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <Section className="pt-6 pb-12 md:pt-8">
      <Container>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white px-6 py-16 text-center shadow-sm shadow-slate-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <SearchIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-brand-navy">No repository selected</h1>
            <p className="mt-1 text-sm text-slate-500">
              Analyze a repository first, then come back here to ask questions about it.
            </p>
          </div>
          <Button href="/analyze" size="md">
            Analyze a repository
          </Button>
        </div>
      </Container>
    </Section>
  );
}

function LoadingState({ repo }: { repo: string }) {
  return (
    <Section className="pt-6 pb-12 md:pt-8">
      <Container>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white px-6 py-16 text-center shadow-sm shadow-slate-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal-50 text-brand-teal">
            <RobotIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-brand-navy">Loading {repo}…</h1>
            <p className="mt-1 text-sm text-slate-500">
              Preparing this repository so you can start asking questions.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function ErrorState({
  repo,
  error,
  onRetry,
}: {
  repo: string;
  error: AnalysisError;
  onRetry: () => void;
}) {
  return (
    <Section className="pt-6 pb-12 md:pt-8">
      <Container>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-red-500">
            <XCircleIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-red-700">Couldn&apos;t load {repo}</h1>
            <p className="mt-1 text-sm text-red-600">{error.message}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" size="md" onClick={onRetry}>
              Try again
            </Button>
            <Button href="/analyze" size="md">
              Analyze a different repository
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
