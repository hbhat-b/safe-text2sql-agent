import { useCallback, useEffect, useRef, useState } from "react";

/** Copies text to the clipboard and flips `copied` for a moment so the UI can confirm it. */
export function useCopy(resetMs = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), resetMs);
      } catch {
        // Clipboard can be unavailable on insecure origins; nothing useful to show.
      }
    },
    [resetMs],
  );

  return { copied, copy };
}
