import { useEffect, useState } from "react";
import { getNextLoaderTip } from "./loaderTipsService";

const MIN_INTERVAL_MS = 5000;
const MAX_INTERVAL_MS = 8000;

function nextTipIntervalMs(): number {
  return MIN_INTERVAL_MS + Math.floor(Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1));
}

/**
 * Rotates loader tips while `active` — each tip stays visible 5–8 seconds.
 */
export function useRotatingLoaderTip(active: boolean): string {
  const [tip, setTip] = useState("");

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const showNext = async () => {
      try {
        const next = await getNextLoaderTip();
        if (!cancelled) setTip(next);
      } catch {
        if (!cancelled) setTip("");
      }
    };

    const scheduleNext = () => {
      timer = setTimeout(() => {
        void showNext().finally(() => {
          if (!cancelled) scheduleNext();
        });
      }, nextTipIntervalMs());
    };

    void showNext().finally(() => {
      if (!cancelled) scheduleNext();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active]);

  return tip;
}
