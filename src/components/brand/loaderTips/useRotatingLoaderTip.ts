import { useEffect, useRef, useState } from "react";
import { getNextLoaderTip } from "./loaderTipsService";

/**
 * One tip per loader session. When the loader hides and shows again, the next tip is fetched.
 */
export function useRotatingLoaderTip(active: boolean): string {
  const [tip, setTip] = useState("");
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (!active) {
      wasActiveRef.current = false;
      return;
    }
    if (wasActiveRef.current) return;
    wasActiveRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const next = await getNextLoaderTip();
        if (!cancelled) setTip(next);
      } catch {
        if (!cancelled) setTip("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active]);

  return tip;
}
