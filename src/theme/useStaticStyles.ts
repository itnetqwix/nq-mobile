import { useMemo } from "react";
import type { AppColors } from "./colors";
import { useThemeColors } from "./ThemeContext";

/**
 * Migrate module-level `StyleSheet.create` that used static `colors`:
 * export function useFooStyles() {
 *   return useStaticStyles((c) => StyleSheet.create({ ... }));
 * }
 */
export function useStaticStyles<T>(factory: (colors: AppColors) => T): T {
  const c = useThemeColors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(c), [c]);
}
