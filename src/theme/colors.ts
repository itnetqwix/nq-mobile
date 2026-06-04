/**
 * Semantic color tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Use `useThemeColors()` in components — never the static `colors` export for UI.
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

type Palette = Record<string, string>;

export const colorsLight: Palette & {
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
  iconPrimary: string;
  iconSecondary: string;
  iconMuted: string;
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

  background: "#ffffff",
  surface: "#f6f7fb",
  surfaceElevated: "#ffffff",
  surfaceMuted: "#f4f4f5",

  text: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  textInverse: "#ffffff",

  border: "#e5e7eb",
  borderSubtle: "#f3f4f6",
  borderStrong: "#d1d5db",
  borderFocus: BRAND.brandAccent,

  input: "#ffffff",
  inputBorder: "#e5e7eb",

  tabBarBorder: "#c5ddf0",
  tabBar: "#eef6fc",
  tabBarActive: BRAND.brand,
  tabBarInactive: "#6b7280",

  headerTitle: BRAND.brand,
  headerTint: BRAND.brand,

  overlay: "rgba(15, 23, 42, 0.6)",
  scrim: "rgba(15, 23, 42, 0.32)",
  overlayVideo: "#000000",

  chatBubbleIncoming: "#eef4fc",
  chatBubbleIncomingText: "#1e293b",
  chatBubbleOutgoing: "#d6e8ff",
  chatBubbleOutgoingText: "#1e3a5a",
  chatDayPill: "rgba(15, 23, 42, 0.08)",
  chatDayPillText: "#6b7280",
  divider: "#e5e7eb",

  /** Icons & accents on surfaces — prefer over raw `brandNavy` in UI. */
  iconPrimary: BRAND.brandAccent,
  iconSecondary: BRAND.brand,
  iconMuted: "#6b7280",

  brandNavy: BRAND.brand,
  sidebarActive: BRAND.brandAccent,
  sidebarActiveBg: BRAND.brandAccentSubtle,
  primary: BRAND.brandAccent,
  primaryPressed: BRAND.brandAccentPressed,

  /** Blinkit-style home header / offers band */
  homeMarketplaceBand: "#fff8e1",
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
  textSecondary: "#e4e4e7",
  /**
   * Bumped from `#9ca3af` to `#b1b8c2` so 13–14 px copy still hits WCAG AA
   * (≥ 4.5:1) against the lighter dark surfaces (`surfaceMuted #222227`,
   * `chatBubbleIncoming #2a2a32`). Previously bordered AA at small sizes.
   */
  textMuted: "#b1b8c2",
  textInverse: "#111827",

  border: NEUTRALS.neutral700,
  borderSubtle: NEUTRALS.neutral800,
  borderStrong: NEUTRALS.neutral600,
  borderFocus: "#64b5f6",

  input: "#1f1f23",
  inputBorder: NEUTRALS.neutral700,

  tabBarBorder: "#2a3d52",
  tabBar: "#141c28",
  tabBarActive: "#64b5f6",
  tabBarInactive: "#b1b8c2",

  headerTitle: "#f9fafb",
  headerTint: "#f9fafb",

  overlay: "rgba(0, 0, 0, 0.72)",
  scrim: "rgba(0, 0, 0, 0.5)",
  overlayVideo: "#000000",

  chatBubbleIncoming: "#2a3444",
  chatBubbleIncomingText: "#e8eef6",
  chatBubbleOutgoing: "#1e3a5f",
  chatBubbleOutgoingText: "#dbeafe",
  chatDayPill: "rgba(255, 255, 255, 0.16)",
  chatDayPillText: "#c7ccd4",
  divider: NEUTRALS.neutral700,

  /** Readable blues on dark surfaces (fixes invisible navy icons). */
  iconPrimary: "#64b5f6",
  iconSecondary: "#90caf9",
  iconMuted: "#b1b8c2",

  brand: "#7c9cff",
  brandNavy: "#7c9cff",
  brandSubtle: "#1e2a45",
  brandAccentSubtle: "#172554",
  brandPressed: "#5c7cfa",
  sidebarActive: "#64b5f6",
  sidebarActiveBg: "#1a2744",
  primary: "#64b5f6",
  primaryPressed: "#42a5f5",

  successSubtle: "#052e16",
  successText: "#86efac",
  warningSubtle: "#422006",
  warningText: "#fcd34d",
  dangerSubtle: "#450a0a",
  dangerText: "#fca5a5",
  infoSubtle: "#172554",
  infoText: "#93c5fd",

  homeMarketplaceBand: "#2a2410",
};

export type AppColors = typeof colorsLight;
