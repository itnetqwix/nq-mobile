import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "../../theme";

type SpaceKey = keyof typeof space;

/**
 * Horizontal padding that respects device safe areas (notch / curved edges /
 * Dynamic Island) so content is never clipped at the sides.
 */
export function useHorizontalGutter(gutter: SpaceKey = "md") {
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const g = space[gutter];
    return {
      paddingLeft: g + insets.left,
      paddingRight: g + insets.right,
      gutter: g,
    };
  }, [gutter, insets.left, insets.right]);
}
