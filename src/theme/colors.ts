/**
 * Semantic color tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * The mobile app's enterprise palette. Web parity in spirit (`#000080` brand
 * navy, `#1976d2` sidebar accent) but expanded with neutral / semantic /
 * dark-mode pairs so every primitive can describe intent instead of hex.
 *
 * Usage:
 *   import { colors } from "@/theme";
 *   <Text style={{ color: colors.text }}>
 *
 * Backwards-compatible aliases preserved (`brandNavy`, `border`, `text`, …)
 * so the gradual screen sweep in Phase 6c doesn't require atomic touches.
 *
 * Dark-mode pairs are exported separately as `colorsDark`; the resolved
 * palette is selected at runtime by `getThemeColors(scheme)` in `index.ts`.
 *
 * Calling / meeting: video stage uses `overlayVideo` (always near-black);
 * modals and chrome should use `useThemeColors()` like other screens.
 */

/** Neutral grayscale ramp — Material/Tailwind hybrid. */
const NEUTRALS = {
  neutral50: "#fafafa",
  neutral100: "#f4f4f5",
  neutral200: "#e4e4e7",
  neutral300: "#d4d4d8",
  neutral400: "#a1a1aa",
  neutral500: "#71717a",
  neutral600: "#52525b",
  neutral700: "#3f3f46",
  neutral800: "#27272a",
  neutral900: "#18181b",
} as const;

const BRAND = {
  brand: "#000080",
  brandSubtle: "#e3e8ff",
  brandTextOn: "#ffffff",
  brandPressed: "#000060",
  /** Sidebar accent (web parity). */
  brandAccent: "#1976d2",
  brandAccentSubtle: "#e3f2fd",
  brandAccentPressed: "#1565c0",
} as const;

const STATUS = {
  success: "#16a34a",
  successSubtle: "#dcfce7",
  successText: "#065f46",
  successTextOn: "#ffffff",
  warning: "#f59e0b",
  warningSubtle: "#fef3c7",
  warningText: "#92400e",
  warningTextOn: "#1c1917",
  danger: "#dc2626",
  dangerSubtle: "#fee2e2",
  dangerText: "#991b1b",
  dangerTextOn: "#ffffff",
  info: "#1976d2",
  infoSubtle: "#e3f2fd",
  infoText: "#1e3a8a",
  infoTextOn: "#ffffff",
} as const;

/**
 * Cast the two palettes to a shared shape so dark mode can be swapped in at
 * runtime without TypeScript complaining about literal-type narrowing.
 */
type Palette = Record<string, string>;

export const colorsLight: Palette & {
  /** Force the keys we know exist to widen to `string` instead of literal. */
  background: string;
  surface: string;
  text: string;
  border: string;
  brandNavy: string;
  brand: string;
  sidebarActive: string;
  sidebarActiveBg: string;
  primary: string;
  primaryPressed: string;
  danger: string;
  success: string;
  warning: string;
  info: string;
  input: string;
  inputBorder: string;
} = {
  ...NEUTRALS,
  ...BRAND,
  ...STATUS,

  /** Surface */
  background: "#ffffff",
  surface: "#f6f7fb",
  surfaceElevated: "#ffffff",
  surfaceMuted: "#f4f4f5",

  /** Text */
  text: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  textInverse: "#ffffff",

  /** Border */
  border: "#e5e7eb",
  borderSubtle: "#f3f4f6",
  borderStrong: "#d1d5db",
  borderFocus: BRAND.brandAccent,

  /** Form input surfaces. */
  input: "#ffffff",
  inputBorder: "#e5e7eb",

  /** Tab bar */
  tabBarBorder: "#e5e7eb",
  tabBar: "#ffffff",
  tabBarActive: BRAND.brandNavy,
  tabBarInactive: "#6b7280",

  /** Navigation chrome (headers, drawer toggle) */
  headerTitle: BRAND.brand,
  headerTint: BRAND.brand,

  /** Overlay (modals, sheets). */
  overlay: "rgba(15, 23, 42, 0.6)",
  scrim: "rgba(15, 23, 42, 0.32)",
  /** Video call stage — always near-black regardless of app theme. */
  overlayVideo: "#000000",

  /** Chat bubbles and day dividers. */
  chatBubbleIncoming: "#f0f0f5",
  chatBubbleOutgoing: BRAND.brand,
  chatBubbleOutgoingText: BRAND.brandTextOn,
  chatDayPill: "rgba(15, 23, 42, 0.08)",
  chatDayPillText: "#6b7280",
  divider: "#e5e7eb",

  /** Compatibility aliases (do NOT remove). */
  brandNavy: BRAND.brand,
  sidebarActive: BRAND.brandAccent,
  sidebarActiveBg: BRAND.brandAccentSubtle,
  primary: BRAND.brandAccent,
  primaryPressed: BRAND.brandAccentPressed,
};

export const colorsDark: typeof colorsLight = {
  ...NEUTRALS,
  ...BRAND,
  ...STATUS,

  background: NEUTRALS.neutral900,
  surface: NEUTRALS.neutral800,
  surfaceElevated: "#1f1f23",
  surfaceMuted: "#222227",

  text: "#f9fafb",
  textSecondary: "#d4d4d8",
  textMuted: "#9ca3af",
  textInverse: "#111827",

  border: NEUTRALS.neutral700,
  borderSubtle: NEUTRALS.neutral800,
  borderStrong: NEUTRALS.neutral600,
  borderFocus: BRAND.brandAccent,

  input: "#1f1f23",
  inputBorder: NEUTRALS.neutral700,

  tabBarBorder: NEUTRALS.neutral700,
  tabBar: "#0f0f12",
  tabBarActive: BRAND.brandAccent,
  tabBarInactive: "#9ca3af",

  headerTitle: "#f9fafb",
  headerTint: "#f9fafb",

  overlay: "rgba(0, 0, 0, 0.72)",
  scrim: "rgba(0, 0, 0, 0.5)",
  overlayVideo: "#000000",

  chatBubbleIncoming: "#2a2a32",
  chatBubbleOutgoing: BRAND.brand,
  chatBubbleOutgoingText: BRAND.brandTextOn,
  chatDayPill: "rgba(255, 255, 255, 0.12)",
  chatDayPillText: "#a1a1aa",
  divider: NEUTRALS.neutral700,

  /** Compatibility aliases. */
  brandNavy: BRAND.brand,
  sidebarActive: BRAND.brandAccent,
  sidebarActiveBg: "#1a2a3f",
  primary: BRAND.brandAccent,
  primaryPressed: BRAND.brandAccentPressed,
};

export type AppColors = typeof colorsLight;
