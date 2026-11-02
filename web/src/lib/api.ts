import { useMutation, useQuery } from "@tanstack/react-query";
import { answerFailed, answerFinished, questionAsked, stepReceived } from "./chatSlice";
import { useAppDispatch } from "./store";
import type { ServerEvent, StepEvent } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL = API_URL.replace(/^http/, "ws") + "/ws/query";

/**
 * Opens a socket for a single question and resolves once the server sends `done`.
 * One socket per question keeps concurrent or abandoned runs from interleaving.
 */
export function streamQuestion(question: string, onStep: (step: StepEvent) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      ws.close();
      err ? reject(err) : resolve();
    };

    ws.onopen = () => ws.send(JSON.stringify({ question }));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerEvent;
      if (msg.type === "step") onStep(msg);
      else if (msg.type === "done") finish();
      else if (msg.type === "error") finish(new Error(msg.message));
    };
    ws.onerror = () => finish(new Error("Could not reach the agent server."));
    ws.onclose = () => finish(new Error("Connection closed before the answer finished."));
  });
}

/** Sends a question and streams the agent's steps into the Redux transcript. */
export function useAskQuestion() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: async (question: string) => {
      const { payload } = dispatch(questionAsked(question));
      const id = payload.assistantId;
      try {
        await streamQuestion(question, (step) => dispatch(stepReceived({ id, step })));
        dispatch(answerFinished(id));
      } catch (e) {
        dispatch(answerFailed({ id, error: e instanceof Error ? e.message : String(e) }));
        throw e;
      }
    },
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
      return (await res.json()) as { status: string };
    },
    refetchInterval: 15_000,
    retry: false,
  });
}
