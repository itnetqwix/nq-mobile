import { useMemo } from "react";
import type { AppColors } from "./colors";
import { useThemeColors } from "./ThemeContext";

/**
 * Build StyleSheets from the active palette. Recomputes when light/dark changes.
 *
 *   const styles = useThemedStyles((c) => StyleSheet.create({ root: { backgroundColor: c.background } }));
 */
export function useThemedStyles<T>(factory: (colors: AppColors) => T): T {
  const c = useThemeColors();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- factory is typically inline StyleSheet.create
  return useMemo(() => factory(c), [c]);
}
