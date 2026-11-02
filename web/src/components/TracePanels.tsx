"use client";

import { Check, ChevronRight, CircleX, Copy, Download, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AssistantMessage, Attempt, QueryResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCopy } from "./useCopy";

/** The result of the last attempt that executed successfully, if any. */
export function finalResult(message: AssistantMessage): QueryResult | undefined {
  for (let i = message.attempts.length - 1; i >= 0; i--) {
    const ex = message.attempts[i].execution;
    if (ex?.ok) return ex.result;
  }
  return undefined;
}

function attemptError(a: Attempt): string | undefined {
  if (a.guardrail && !a.guardrail.ok) return a.guardrail.error;
  if (a.execution && !a.execution.ok) return a.execution.error;
  return undefined;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => copy(text)}>
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function Code({ children, className }: { children: string; className?: string }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words",
        className,
      )}
    >
      {children}
    </pre>
  );
}

function Panel({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card size="sm" className="mt-2 gap-0 py-0 shadow-sm animate-in fade-in slide-in-from-top-1">
      <CardHeader className="border-b py-2! [.border-b]:pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {action && <CardAction className="self-center">{action}</CardAction>}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

export function SqlPanel({ message }: { message: AssistantMessage }) {
  const attempts = message.attempts;
  const final = attempts[attempts.length - 1];
  const earlier = attempts.slice(0, -1);

  return (
    <Panel
      title={<>Generated SQL{attempts.length > 1 && ` · Attempt ${final.n}`}</>}
      action={<CopyButton text={final.generatedSql} />}
    >
      <Code className="rounded-none bg-transparent px-4">{final.generatedSql}</Code>

      {earlier.length > 0 && (
        <Collapsible>
          <Separator />
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="group w-full justify-start rounded-none px-4 text-muted-foreground"
            >
              <ChevronRight className="transition-transform group-data-[state=open]:rotate-90" />
              {earlier.length} earlier {earlier.length === 1 ? "attempt" : "attempts"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-4 pb-4">
            {earlier.map((a) => (
              <div key={a.n} className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Attempt {a.n}</div>
                <Code>{a.generatedSql}</Code>
                {attemptError(a) && <p className="text-sm text-destructive">{attemptError(a)}</p>}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </Panel>
  );
}

export function GuardrailPanel({ message }: { message: AssistantMessage }) {
  return (
    <Panel title="Guardrail Checks">
      <ul className="divide-y">
        {message.attempts.map((a) => {
          const g = a.guardrail;
          return (
            <li key={a.n} className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {g?.ok ? (
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CircleX className="size-4 text-destructive" />
                )}
                Attempt {a.n}
                <Badge
                  variant={g?.ok ? "secondary" : "destructive"}
                  className={cn(g?.ok && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}
                >
                  {g ? (g.ok ? "Passed" : "Rejected") : "Not checked"}
                </Badge>
              </div>
              {g?.ok ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Read-only, known tables only, row limit enforced. Executed as:
                  </p>
                  <Code>{g.sql}</Code>
                  {a.execution && !a.execution.ok && <p className="text-sm text-destructive">{a.execution.error}</p>}
                </>
              ) : (
                g && <p className="text-sm text-destructive">{g.error}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function toCsv({ columns, rows }: QueryResult): string {
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "result.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsPanel({ result }: { result: QueryResult }) {
  const csv = toCsv(result);
  const numeric = result.columns.map((_, j) => result.rows.length > 0 && result.rows.every((r) => typeof r[j] === "number"));

  return (
    <Panel
      title={`Result · ${result.rows.length} ${result.rows.length === 1 ? "Row" : "Rows"}`}
      action={
        <div className="flex gap-0.5">
          <CopyButton text={csv} label="Copy CSV" />
          <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => download(csv)}>
            <Download />
            CSV
          </Button>
        </div>
      }
    >
      <ScrollArea className="max-h-90 [&>[data-slot=scroll-area-viewport]]:max-h-90">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              {result.columns.map((c, j) => (
                <TableHead key={c} className={cn("px-4", numeric[j] && "text-right")}>
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((v, j) => (
                  <TableCell key={j} className={cn("px-4", numeric[j] && "text-right tabular-nums")}>
                    {v == null ? <span className="text-muted-foreground italic">NULL</span> : String(v)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Panel>
  );
}
