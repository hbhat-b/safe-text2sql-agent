import { BarChart3, Globe2, Music2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  { icon: Music2, text: "Top 5 artists by number of tracks" },
  { icon: Globe2, text: "Which country has the most customers?" },
  { icon: BarChart3, text: "Total sales by year" },
  { icon: ShieldAlert, text: "Delete all customers", hint: "See the guardrail block it" },
];

export function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-[10vh] pb-8 text-center sm:px-5">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">What would you like to know?</h1>
      <p className="mx-auto mt-2 mb-8 max-w-lg text-muted-foreground">
        Ask about artists, albums, customers or sales. Every query is checked by a guardrail and run read-only
        against the database.
      </p>
      <div className="grid gap-2.5 text-left sm:grid-cols-2">
        {SUGGESTIONS.map(({ icon: Icon, text, hint }) => (
          <Button
            key={text}
            variant="outline"
            className="h-auto items-start justify-start gap-3 rounded-xl p-4 text-left whitespace-normal"
            onClick={() => onPick(text)}
          >
            <Icon className="mt-0.5 text-muted-foreground" />
            <span className="flex flex-col gap-0.5">
              <span>{text}</span>
              {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
