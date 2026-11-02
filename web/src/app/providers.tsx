"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Provider } from "react-redux";
import { TooltipProvider } from "@/components/ui/tooltip";
import { makeStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </QueryClientProvider>
      </Provider>
    </ThemeProvider>
  );
}
