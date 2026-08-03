"use client";

import { useState } from "react";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { AskRepoSummary } from "@/components/ask/AskRepoSummary";
import { AskGreeting } from "@/components/ask/AskGreeting";
import { ConversationPanel, type ChatMessage } from "@/components/ask/ConversationPanel";
import { RepositoryContextCard } from "@/components/ask/RepositoryContextCard";
import { TopFilesCard } from "@/components/ask/TopFilesCard";
import { TipsCard } from "@/components/ask/TipsCard";
import { MOCK_ASK_METADATA, SUGGESTED_QUESTIONS } from "@/lib/mock-ask-data";
import type { SuggestedQuestion } from "@/lib/mock-ask-data";

type MobileTab = "chat" | "context";

/** A single canned reply — this is UI-only, there's no AI behind it. See PR notes. */
const MOCK_ASSISTANT_REPLY =
  "This is a placeholder response. Once RepoLens is connected to the live analysis and Q&A backend, I'll answer using real context from this repository.";

/**
 * /ask — rebuilt to match the reference design.
 *
 * Fully mock-data driven (see lib/mock-ask-data.ts): the repository summary,
 * suggested questions, and sidebar (context/top files/tips) are all static
 * mocks. The conversation itself is interactive — typing or picking a
 * suggested question appends it to the thread and, after a short delay,
 * shows a single canned reply. There is no AI and no API call anywhere on
 * this page. See PR notes for the full list of backend gaps.
 */
export default function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  const appendExchange = (userText: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: userText };
    setMessages((prev) => [...prev, userMsg]);

    window.setTimeout(() => {
      const replyMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: MOCK_ASSISTANT_REPLY,
      };
      setMessages((prev) => [...prev, replyMsg]);
    }, 600);
  };

  const handleSelectQuestion = (q: SuggestedQuestion) => appendExchange(q.title);

  return (
    <Section className="pt-6 pb-12 md:pt-8">
      <Container>
        <div className="space-y-6">
          <AskRepoSummary metadata={MOCK_ASK_METADATA} />

          {/* Mobile tab switcher — desktop always shows both columns */}
          <div className="flex gap-6 border-b border-slate-100 lg:hidden">
            <TabButton label="Chat" active={mobileTab === "chat"} onClick={() => setMobileTab("chat")} />
            <TabButton label="Context" active={mobileTab === "context"} onClick={() => setMobileTab("context")} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className={`space-y-4 lg:col-span-2 ${mobileTab === "context" ? "hidden lg:block" : ""}`}>
              <AskGreeting questions={SUGGESTED_QUESTIONS} onSelectQuestion={handleSelectQuestion} />
              <ConversationPanel messages={messages} onSend={appendExchange} />
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
