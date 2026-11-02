/** Shapes streamed by the FastAPI `/ws/query` endpoint. */

export type QueryResult = {
  columns: string[];
  rows: unknown[][];
};

export type AgentNode =
  | "load_schema"
  | "generate_sql"
  | "validate_sql"
  | "execute_sql"
  | "answer"
  | "decline"
  | "give_up";

export type StepEvent = {
  type: "step";
  node: AgentNode;
  data: {
    sql?: string;
    attempts?: number;
    error?: string | null;
    result?: QueryResult;
    answer?: string;
    /** Set on generate_sql when the model replied without SQL (e.g. a refusal). */
    declined?: boolean;
  };
};

export type ServerEvent =
  | StepEvent
  | { type: "done" }
  | { type: "error"; message: string };

/** One generate -> validate -> execute cycle. The agent retries on guardrail or DB errors. */
export type Attempt = {
  n: number;
  generatedSql: string;
  guardrail?: { ok: true; sql: string } | { ok: false; error: string };
  execution?: { ok: true; result: QueryResult } | { ok: false; error: string };
};

export type Stage = "thinking" | "writing_sql" | "checking" | "running" | "retrying" | "answering";

export type UserMessage = { id: string; role: "user"; content: string };

export type AssistantMessage = {
  id: string;
  role: "assistant";
  status: "streaming" | "done" | "error";
  stage: Stage;
  attempts: Attempt[];
  answer?: string;
  /** How the run ended: a normal answer, a polite refusal, or out of retries. */
  outcome?: "answered" | "declined" | "gave_up";
  error?: string;
};

export type Message = UserMessage | AssistantMessage;
