/**
 * `<CoachMark>` — wraps a target view and registers a one-time tooltip with
 * the {@link CoachMarkProvider}. The tooltip renders into a single overlay
 * managed by `<CoachMarkOverlay>` so multiple marks can never stack.
 *
 * Usage:
 *   <CoachMark
 *     id="dashboard.firstSession"
 *     title="Book your first lesson"
 *     description="Tap here to browse experts and book a slot."
 *     placement="bottom"
 *   >
 *     <Pressable onPress={onBook}>…</Pressable>
 *   </CoachMark>
 *
 * Implementation notes:
 *   - We use `measureInWindow` because the React Navigation header offsets
 *     `measure()` coordinates in ways that confuse arrow placement.
 *   - Re-measure on layout *and* on the first paint after mount; some
 *     children (FlatList rows, etc.) start at 0/0 until their parent
 *     finishes layout.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { LayoutChangeEvent, View, type ViewProps } from "react-native";
import { useCoachMarkContext } from "./CoachMarkProvider";

type Props = ViewProps & {
  /** Stable, unique id — used as the persistence key. */
  id: string;
  title: string;
  description: string;
  icon?: string;
  placement?: "top" | "bottom" | "auto";
  cta?: { label: string; onPress: () => void };
  /** Skip showing this mark even if unseen (e.g. when a higher-priority
   *  dialog is on screen). Defaults to `false`. */
  disabled?: boolean;
  children: React.ReactNode;
};

export function CoachMark({
  id,
  title,
  description,
  icon,
  placement = "auto",
  cta,
  disabled = false,
  children,
  onLayout,
  ...rest
}: Props) {
  const { request, suspended } = useCoachMarkContext();
  const ref = useRef<View | null>(null);
  const submittedRef = useRef(false);

  const submit = useCallback(() => {
    if (suspended || disabled || submittedRef.current) return;
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      submittedRef.current = true;
      void request({
        id,
        title,
        description,
        icon,
        placement,
        cta,
        anchor: { x, y, width, height },
      });
    });
  }, [cta, description, disabled, icon, id, placement, request, suspended, title]);

  useEffect(() => {
    /**
     * First-render measurement — wait a beat for the layout to settle so
     * `measureInWindow` returns the post-layout coords rather than 0/0.
     */
    const t = setTimeout(submit, 350);
    return () => clearTimeout(t);
  }, [submit]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayout?.(e);
      submit();
    },
    [onLayout, submit]
  );

  return (
    <View ref={ref} onLayout={handleLayout} collapsable={false} {...rest}>
      {children}
    </View>
  );
}
