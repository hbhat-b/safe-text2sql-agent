"use client";

import { useEffect, useRef } from "react";
import { ChatHeader } from "@/components/ChatHeader";
import { Composer } from "@/components/Composer";
import { EmptyState } from "@/components/EmptyState";
import { AssistantTurn, UserTurn } from "@/components/Message";
import { useAskQuestion } from "@/lib/api";
import { selectIsBusy, selectMessages, useAppSelector } from "@/lib/store";

export default function ChatPage() {
  const messages = useAppSelector(selectMessages);
  const busy = useAppSelector(selectIsBusy);
  const ask = useAskQuestion();
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = (question: string) => {
    if (!question.trim() || busy) return;
    ask.mutate(question.trim());
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex h-dvh flex-col">
      <ChatHeader />
      <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {messages.length === 0 ? (
          <EmptyState onPick={send} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-5">
            {messages.map((m) =>
              m.role === "user" ? <UserTurn key={m.id} content={m.content} /> : <AssistantTurn key={m.id} message={m} onAsk={send} />,
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </main>
      <Composer busy={busy} onSend={send} />
    </div>
  );
}
