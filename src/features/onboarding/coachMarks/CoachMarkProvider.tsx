/**
 * CoachMarkProvider — central queue + storage for in-place coach marks.
 *
 * Why a provider instead of "render-where-you-need-it" tooltips?
 *   - Only ONE coach mark should be visible at a time (otherwise we just
 *     recreate the modal-tour fatigue we're trying to avoid).
 *   - "Seen" state has to persist across mounts so a hint shown on screen A
 *     doesn't reappear when the user comes back from screen B.
 *   - The provider also exposes a `requestShow(id, anchor)` API so the
 *     `<CoachMark>` JSX wrapper can register itself once its target view
 *     reports a stable layout.
 *
 * The provider intentionally lives just inside `AuthProvider` so a logged-
 * out user never sees hints intended for signed-in surfaces.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo } from "react-native";
import { hasSeenCoachMark, markCoachMarkSeen, resetCoachMarks } from "./storage";

export type CoachMarkAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CoachMarkPayload = {
  id: string;
  title: string;
  description: string;
  /** Icon name (Ionicons) for the leading glyph. Optional. */
  icon?: string;
  /** Anchor (target view) screen-coords. */
  anchor: CoachMarkAnchor;
  /** Preferred placement; we fall back to the opposite side if it doesn't fit. */
  placement?: "top" | "bottom" | "auto";
  /** Optional "Show me" CTA — fires when user taps the primary button. */
  cta?: { label: string; onPress: () => void };
  /** Optional analytics hook. */
  onShown?: () => void;
};

type RegisterArgs = Omit<CoachMarkPayload, "anchor"> & { anchor: CoachMarkAnchor };

type Ctx = {
  /** The currently visible coach mark (provider chooses which to show next). */
  active: CoachMarkPayload | null;
  /** Register a coach mark for later display. Returns `false` if already seen. */
  request: (m: RegisterArgs) => Promise<boolean>;
  /** Dismiss the currently visible mark and persist its id. */
  dismiss: () => void;
  /** Imperatively check if a coach mark id has been seen. */
  isSeen: (id: string) => Promise<boolean>;
  /** Wipe storage — used by the "Replay onboarding" debug action. */
  reset: () => Promise<void>;
  /** When `true`, never show coach marks — respects OS Reduce Motion / SR. */
  suspended: boolean;
};

const CoachMarkContext = createContext<Ctx | null>(null);

export function CoachMarkProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<CoachMarkPayload | null>(null);
  const queueRef = useRef<CoachMarkPayload[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    /**
     * Honour the OS "Reduce Motion" pref by suspending coach marks — they
     * pop in with a small spring and are intrusive. Screen reader users
     * also get suspended because the hint content is already announced via
     * the live elements they're navigating, and an overlay would interrupt
     * focus order.
     */
    let mounted = true;
    void Promise.all([
      AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
    ]).then(([rm, sr]) => {
      if (!mounted) return;
      setSuspended(!!rm || !!sr);
    });

    const sub1 = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setSuspended((s) => !!v || s)
    );
    const sub2 = AccessibilityInfo.addEventListener("screenReaderChanged", (v) =>
      setSuspended((s) => !!v || s)
    );
    return () => {
      mounted = false;
      if (sub1 && typeof (sub1 as { remove?: () => void }).remove === "function") {
        (sub1 as { remove: () => void }).remove();
      }
      if (sub2 && typeof (sub2 as { remove?: () => void }).remove === "function") {
        (sub2 as { remove: () => void }).remove();
      }
    };
  }, []);

  const showNext = useCallback(() => {
    if (suspended) return;
    setActive((current) => {
      if (current) return current;
      const next = queueRef.current.shift() ?? null;
      if (next) next.onShown?.();
      return next;
    });
  }, [suspended]);

  const request = useCallback(
    async (m: RegisterArgs) => {
      if (suspended) return false;
      if (seenRef.current.has(m.id)) return false;
      const seenOnDisk = await hasSeenCoachMark(m.id);
      if (seenOnDisk) {
        seenRef.current.add(m.id);
        return false;
      }
      queueRef.current = queueRef.current.filter((q) => q.id !== m.id);
      queueRef.current.push({ ...m, anchor: m.anchor });
      /**
       * Defer to the next tick so the anchor view has time to settle
       * after a navigation transition / layout pass — otherwise the
       * tooltip arrow points at the previous frame's position.
       */
      setTimeout(showNext, 250);
      return true;
    },
    [showNext, suspended]
  );

  const dismiss = useCallback(() => {
    setActive((current) => {
      if (current) {
        seenRef.current.add(current.id);
        void markCoachMarkSeen(current.id);
      }
      return null;
    });
    setTimeout(showNext, 200);
  }, [showNext]);

  const isSeen = useCallback(async (id: string) => {
    if (seenRef.current.has(id)) return true;
    const v = await hasSeenCoachMark(id);
    if (v) seenRef.current.add(id);
    return v;
  }, []);

  const reset = useCallback(async () => {
    seenRef.current.clear();
    queueRef.current = [];
    setActive(null);
    await resetCoachMarks();
  }, []);

  const value = useMemo<Ctx>(
    () => ({ active, request, dismiss, isSeen, reset, suspended }),
    [active, request, dismiss, isSeen, reset, suspended]
  );

  return <CoachMarkContext.Provider value={value}>{children}</CoachMarkContext.Provider>;
}

export function useCoachMarkContext(): Ctx {
  const ctx = useContext(CoachMarkContext);
  if (!ctx) {
    /**
     * Safe no-op fallback — keeps tests and storybook stubs renderable
     * without wrapping every render tree in the provider.
     */
    return {
      active: null,
      request: async () => false,
      dismiss: () => undefined,
      isSeen: async () => true,
      reset: async () => undefined,
      suspended: true,
    };
  }
  return ctx;
}
