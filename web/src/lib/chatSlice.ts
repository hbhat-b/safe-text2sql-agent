import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";
import type { AssistantMessage, Message, StepEvent } from "./types";

type ChatState = { messages: Message[] };

const initialState: ChatState = { messages: [] };

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    questionAsked: {
      reducer(state, action: PayloadAction<{ userId: string; assistantId: string; question: string }>) {
        const { userId, assistantId, question } = action.payload;
        state.messages.push({ id: userId, role: "user", content: question });
        state.messages.push({
          id: assistantId,
          role: "assistant",
          status: "streaming",
          stage: "thinking",
          attempts: [],
        });
      },
      prepare(question: string) {
        return { payload: { userId: nanoid(), assistantId: nanoid(), question } };
      },
    },

    stepReceived(state, action: PayloadAction<{ id: string; step: StepEvent }>) {
      const msg = findAssistant(state, action.payload.id);
      if (!msg) return;
      const { node, data } = action.payload.step;
      const current = msg.attempts[msg.attempts.length - 1];

      switch (node) {
        case "load_schema":
          msg.stage = "writing_sql";
          break;
        case "generate_sql":
          if (data.declined) break; // no query to show; a decline step follows
          msg.attempts.push({ n: data.attempts ?? msg.attempts.length + 1, generatedSql: data.sql ?? "" });
          msg.stage = "checking";
          break;
        case "validate_sql":
          if (!current) break;
          if (data.error) {
            current.guardrail = { ok: false, error: data.error };
            msg.stage = "retrying";
          } else {
            current.guardrail = { ok: true, sql: data.sql ?? current.generatedSql };
            msg.stage = "running";
          }
          break;
        case "execute_sql":
          if (!current) break;
          if (data.error) {
            current.execution = { ok: false, error: data.error };
            msg.stage = "retrying";
          } else if (data.result) {
            current.execution = { ok: true, result: data.result };
            msg.stage = "answering";
          }
          break;
        case "answer":
          msg.answer = data.answer ?? "";
          msg.outcome = "answered";
          break;
        case "decline":
          msg.answer = data.answer ?? "";
          msg.outcome = "declined";
          break;
        case "give_up":
          msg.answer = data.answer ?? "";
          msg.outcome = "gave_up";
          break;
      }
    },

    answerFinished(state, action: PayloadAction<string>) {
      const msg = findAssistant(state, action.payload);
      if (msg && msg.status === "streaming") msg.status = "done";
    },

    answerFailed(state, action: PayloadAction<{ id: string; error: string }>) {
      const msg = findAssistant(state, action.payload.id);
      if (!msg) return;
      msg.status = "error";
      msg.error = action.payload.error;
    },

    chatCleared(state) {
      state.messages = [];
    },
  },
});

function findAssistant(state: ChatState, id: string): AssistantMessage | undefined {
  const msg = state.messages.find((m) => m.id === id);
  return msg?.role === "assistant" ? msg : undefined;
}

export const { questionAsked, stepReceived, answerFinished, answerFailed, chatCleared } = chatSlice.actions;
export default chatSlice.reducer;
