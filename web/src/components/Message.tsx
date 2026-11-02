"use client";

import {
  AlertTriangle,
  Check,
  CircleHelp,
  Code2,
  Copy,
  DatabaseSearch,
  Info,
  ShieldAlert,
  ShieldCheck,
  Table2,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AssistantMessage, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import { GuardrailPanel, ResultsPanel, SqlPanel, finalResult } from "./TracePanels";
import { useCopy } from "./useCopy";

export function UserTurn({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-in fade-in slide-in-from-bottom-1">
      <div className="max-w-[90%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 whitespace-pre-wrap break-words sm:max-w-[80%]">
        {content}
      </div>
    </div>
  );
}

type Panel = "sql" | "guardrail" | "results";

export function AssistantTurn({ message, onAsk }: { message: AssistantMessage; onAsk: (q: string) => void }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const { copied, copy } = useCopy();

  const streaming = message.status === "streaming";
  const last = message.attempts[message.attempts.length - 1];
  const result = finalResult(message);
  const guardrailOk = last?.guardrail?.ok;

  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-1">
      <Avatar size="sm" className="mt-0.5">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <DatabaseSearch className="size-3.5" />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        {streaming && !message.answer && <Progress stage={message.stage} attempt={message.attempts.length} />}

        {message.answer && message.outcome === "answered" && <Markdown>{message.answer}</Markdown>}

        {message.answer && message.outcome === "declined" && (
          <Notice icon={<Info />} title="That's outside what I can do" onAsk={onAsk}>
            {message.answer}
          </Notice>
        )}

        {message.answer && message.outcome === "gave_up" && (
          <Notice icon={<CircleHelp />} title="I couldn't answer that one" onAsk={onAsk}>
            {message.answer}
          </Notice>
        )}

        {message.status === "error" && (
          <Alert variant="destructive" className="mt-1">
            <AlertTriangle />
            <AlertTitle>Couldn&apos;t reach the agent</AlertTitle>
            <AlertDescription>
              {message.error} Check that the API is running, then try again.
            </AlertDescription>
          </Alert>
        )}

        {!streaming && message.attempts.length > 0 && (
          <>
            <div className="-ml-1.5 mt-2 flex items-center gap-0.5">
              {message.answer && (
                <IconTip label={copied ? "Copied" : "Copy answer"}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    aria-label="Copy answer"
                    onClick={() => copy(message.answer!)}
                  >
                    {copied ? <Check /> : <Copy />}
                  </Button>
                </IconTip>
              )}

              <ToggleGroup
                type="single"
                size="sm"
                spacing={0.5}
                value={open ?? ""}
                onValueChange={(v) => setOpen((v || null) as Panel | null)}
                aria-label="Response details"
              >
                <IconTip label="Generated SQL">
                  <ToggleGroupItem value="sql" aria-label="Generated SQL" className="px-0 text-muted-foreground">
                    <Code2 />
                  </ToggleGroupItem>
                </IconTip>
                <IconTip label={guardrailOk ? "Guardrail passed" : "Guardrail rejected"}>
                  <ToggleGroupItem
                    value="guardrail"
                    aria-label={guardrailOk ? "Guardrail passed" : "Guardrail rejected"}
                    className={cn("px-0", guardrailOk ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}
                  >
                    {guardrailOk ? <ShieldCheck /> : <ShieldAlert />}
                  </ToggleGroupItem>
                </IconTip>
                {result && (
                  <IconTip label={`Result · ${result.rows.length} ${result.rows.length === 1 ? "row" : "rows"}`}>
                    <ToggleGroupItem value="results" aria-label="Query result" className="px-0 text-muted-foreground">
                      <Table2 />
                    </ToggleGroupItem>
                  </IconTip>
                )}
              </ToggleGroup>

              {message.attempts.length > 1 && (
                <Badge variant="secondary" className="ml-1.5 font-normal text-muted-foreground">
                  {message.attempts.length} attempts
                </Badge>
              )}
            </div>

            {open === "sql" && <SqlPanel message={message} />}
            {open === "guardrail" && <GuardrailPanel message={message} />}
            {open === "results" && result && <ResultsPanel result={result} />}
          </>
        )}
      </div>
    </div>
  );
}

const FOLLOW_UPS = [
  "How many customers are there?",
  "Top 5 artists by number of tracks",
  "Total sales by year",
];

/** A calm, non-error reply for refusals and give-ups, with questions the user can try next. */
function Notice({
  icon,
  title,
  onAsk,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onAsk: (q: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <Alert className="bg-muted/40">
        {icon}
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="text-foreground/80">{children}</AlertDescription>
      </Alert>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-xs text-muted-foreground">Try asking</span>
        {FOLLOW_UPS.map((q) => (
          <Button key={q} variant="outline" size="xs" className="rounded-full font-normal" onClick={() => onAsk(q)}>
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
}

function IconTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const STEPS: { label: string; stages: Stage[] }[] = [
  { label: "Schema", stages: ["thinking"] },
  { label: "SQL", stages: ["writing_sql", "retrying"] },
  { label: "Guardrail", stages: ["checking"] },
  { label: "Execute", stages: ["running"] },
  { label: "Answer", stages: ["answering"] },
];

const STAGE_TEXT: Record<Stage, string> = {
  thinking: "Reading the schema",
  writing_sql: "Writing SQL",
  checking: "Checking guardrails",
  running: "Running the query",
  retrying: "Fixing the query and retrying",
  answering: "Writing the answer",
};

function Progress({ stage, attempt }: { stage: Stage; attempt: number }) {
  const current = STEPS.findIndex((s) => s.stages.includes(stage));
  return (
    <div className="pt-1" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <span className="shimmer font-medium">{STAGE_TEXT[stage]}</span>
        {stage === "retrying" && (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            attempt {attempt + 1}
          </Badge>
        )}
      </div>
      <ol className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {STEPS.map((s, i) => (
          <li key={s.label} className={cn("inline-flex items-center gap-1.5", i === current && "text-foreground")}>
            <span
              className={cn(
                "size-1.5 rounded-full bg-border",
                i < current && "bg-emerald-500",
                i === current && "animate-pulse bg-foreground",
              )}
            />
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
