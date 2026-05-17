import { useEffect, useState } from "react";
import { getNextLoaderTip } from "./loaderTipsService";

/**
 * Rotates loader tips while `active` — each tip is unique until the full deck is shown.
 */
export function useRotatingLoaderTip(active: boolean, intervalMs = 4200): string {
  const [tip, setTip] = useState("");

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    const showNext = async () => {
      try {
        const next = await getNextLoaderTip();
        if (!cancelled) setTip(next);
      } catch {
        if (!cancelled) setTip("");
      }
    };

    void showNext();
    const id = setInterval(() => void showNext(), intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, intervalMs]);

  return tip;
}
