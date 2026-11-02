"use client";

import { Database, Moon, SquarePen, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHealth } from "@/lib/api";
import { chatCleared } from "@/lib/chatSlice";
import { selectIsBusy, selectMessages, useAppDispatch, useAppSelector } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ChatHeader() {
  const dispatch = useAppDispatch();
  const hasMessages = useAppSelector(selectMessages).length > 0;
  const busy = useAppSelector(selectIsBusy);
  const health = useHealth();
  const { resolvedTheme, setTheme } = useTheme();

  const status = health.isPending ? "checking" : health.isSuccess ? "online" : "offline";
  const label = { checking: "Connecting", online: "Agent online", offline: "Agent offline" }[status];

  return (
    <header className="flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Database className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Safe Text-to-SQL</div>
          <div className="hidden text-xs text-muted-foreground sm:block">Chinook music store · read-only</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="hidden gap-1.5 font-normal text-muted-foreground sm:inline-flex">
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "online" && "bg-emerald-500",
              status === "offline" && "bg-destructive",
              status === "checking" && "bg-muted-foreground animate-pulse",
            )}
          />
          {label}
        </Badge>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              <Sun className="hidden dark:block" />
              <Moon className="dark:hidden" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>

        <Button variant="outline" onClick={() => dispatch(chatCleared())} disabled={!hasMessages || busy}>
          <SquarePen />
          <span className="hidden sm:inline">New chat</span>
        </Button>
      </div>
    </header>
  );
}
