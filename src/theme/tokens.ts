/**
 * Back-compat shim.
 *
 * The canonical theme barrel is now `./index.ts`. Every existing
 * `import { colors, space, radii, layout } from "../../theme/tokens"`
 * continues to work — internally it now points at the expanded color
 * palette + typography / shadow / motion tokens.
 *
 * New code should import from `"../../theme"` instead.
 */

export {
  colors,
  colorsDark,
  colorsLight,
  resolveColors,
  useThemeColors,
  space,
  radii,
  layout,
  typography,
  shadows,
  durations,
  easings,
  type AppColors,
  type TypographyToken,
  type ShadowToken,
  type DurationToken,
  type EasingToken,
} from "./index";
