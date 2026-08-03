"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChatIcon, PaperclipIcon, RobotIcon, SendIcon } from "@/components/icons";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** True while this assistant message is a placeholder awaiting the real response. */
  pending?: boolean;
  /** True when this assistant message represents a request/backend error. */
  isError?: boolean;
  /** File paths the backend used as context for this answer, if any. */
  referencedFiles?: string[];
  /** Model confidence for this answer, if the backend returned one. */
  confidence?: number;
  /** Source references for this answer, if the backend returned any. */
  sources?: string[];
}

interface ConversationPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled?: boolean;
}

/**
 * Conversation area: empty state -> message thread, plus the input footer.
 *
 * This is UI-only — `onSend` is wired up by the page to append messages
 * and show one canned assistant reply (see PR notes). No AI, no API calls.
 */
export function ConversationPanel({ messages, onSend, disabled }: ConversationPanelProps) {
  const [value, setValue] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm shadow-slate-100">
        {messages.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ChatIcon className="h-5 w-5" />
            </span>
            <h3 className="text-base font-bold text-brand-navy">Start a conversation</h3>
            <p className="text-sm text-slate-500">
              Ask a question above or type your own question below.
            </p>
          </div>
        ) : (
          <div ref={threadRef} className="max-h-[420px] space-y-4 overflow-y-auto p-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm shadow-slate-100">
        <div className="flex items-end gap-2.5">
          <button
            type="button"
            aria-label="Attach a file"
            disabled={disabled}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <PaperclipIcon className="h-4 w-4" />
          </button>
          <textarea
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about this repository..."
            className="h-11 max-h-32 flex-1 resize-none rounded-lg border border-slate-200 px-3.5 py-3 text-sm leading-tight text-brand-navy placeholder:text-slate-400 focus:border-brand-teal focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand-teal px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-600 disabled:pointer-events-none disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
            Send
          </button>
        </div>
        <p className="mt-2 pl-1 text-xs text-slate-400">Press Enter to send, Shift + Enter for new line</p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-teal px-4 py-2.5 text-sm text-white">
          {message.text}
        </div>
      </div>
    );
  }

  const bubbleTone = message.isError
    ? "bg-red-50 text-red-700"
    : "bg-slate-50 text-brand-navy";

  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-teal-50">
        <RobotIcon className="h-4 w-4 text-brand-teal" />
      </span>
      <div className={`max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm ${bubbleTone}`}>
        {message.pending ? (
          <span className="inline-flex items-center gap-1" aria-label="RepoLens AI is thinking">
            <Dot delay="0ms" />
            <Dot delay="150ms" />
            <Dot delay="300ms" />
          </span>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{message.text}</p>

            {message.confidence !== undefined ? (
              <p className="mt-2 text-xs font-semibold text-brand-teal">
                Confidence: {Math.round(message.confidence)}%
              </p>
            ) : null}

            {message.referencedFiles && message.referencedFiles.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {message.referencedFiles.map((path) => (
                  <span
                    key={path}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500"
                  >
                    {path}
                  </span>
                ))}
              </div>
            ) : null}

            {message.sources && message.sources.length > 0 ? (
              <div className="mt-2 text-xs text-slate-500">
                Sources: {message.sources.join(", ")}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
      style={{ animationDelay: delay }}
    />
  );
}
