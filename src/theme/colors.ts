/**
 * Semantic color tokens
 * ─────────────────────────────────────────────────────────────────────────────
 * Use `useThemeColors()` in components — never the static `colors` export for UI.
 */

/** Neutral grayscale ramp — light surfaces. */
const NEUTRALS_LIGHT = {
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

/**
 * Dark-mode neutral ramp — avoids light grays on zinc surfaces (switches,
 * sheet handles, skeleton shimmer).
 */
const NEUTRALS_DARK = {
  neutral50: "#fafafa",
  neutral100: "#2a2a32",
  neutral200: "#35353f",
  neutral300: "#45454f",
  neutral400: "#6b7280",
  neutral500: "#9ca3af",
  neutral600: "#b8bcc6",
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
  skeletonShimmer: string;
} = {
  ...NEUTRALS_LIGHT,
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

  iconPrimary: BRAND.brandAccent,
  iconSecondary: BRAND.brand,
  iconMuted: "#6b7280",

  brandNavy: BRAND.brand,
  sidebarActive: BRAND.brandAccent,
  sidebarActiveBg: BRAND.brandAccentSubtle,
  primary: BRAND.brandAccent,
  primaryPressed: BRAND.brandAccentPressed,

  homeMarketplaceBand: "#fff8e1",
  skeletonShimmer: NEUTRALS_LIGHT.neutral200,
  drawerHeader: BRAND.brand,
  /** In-message search hit highlight. */
  chatSearchHighlight: "#FFF59D",
  chatPresence: STATUS.success,
  chatStatusMuted: "#94a3b8",
  chatStatusRead: BRAND.brandAccent,
};

export const colorsDark: typeof colorsLight = {
  ...NEUTRALS_DARK,
  ...BRAND,
  ...STATUS,

  /** Deepest layer — app chrome behind lists. */
  background: "#0c0c10",
  /** Primary list / screen fill. */
  surface: "#141419",
  /** Cards, rows, modals — one step above surface. */
  surfaceElevated: "#1e1e24",
  /** Skeleton bases, muted wells. */
  surfaceMuted: "#18181e",

  text: "#f4f4f5",
  textSecondary: "#d4d4d8",
  textMuted: "#a8b0bc",
  textInverse: "#111827",

  border: "#2e2e36",
  borderSubtle: "#222228",
  borderStrong: "#45454f",
  borderFocus: "#60a5fa",

  input: "#1a1a20",
  inputBorder: "#35353f",

  tabBarBorder: "#252530",
  tabBar: "#101015",
  tabBarActive: "#60a5fa",
  tabBarInactive: "#a8b0bc",

  headerTitle: "#f4f4f5",
  headerTint: "#f4f4f5",

  overlay: "rgba(0, 0, 0, 0.78)",
  scrim: "rgba(0, 0, 0, 0.58)",
  overlayVideo: "#000000",

  chatBubbleIncoming: "#252b38",
  chatBubbleIncomingText: "#e8eef6",
  chatBubbleOutgoing: "#1a3658",
  chatBubbleOutgoingText: "#dbeafe",
  chatDayPill: "rgba(255, 255, 255, 0.12)",
  chatDayPillText: "#b8bcc6",
  divider: "#2e2e36",

  iconPrimary: "#60a5fa",
  iconSecondary: "#93c5fd",
  iconMuted: "#a8b0bc",

  brand: "#8ba4ff",
  brandNavy: "#8ba4ff",
  brandSubtle: "#1a2744",
  brandAccent: "#60a5fa",
  brandAccentSubtle: "#172a45",
  brandAccentPressed: "#3b82f6",
  brandPressed: "#6b8cff",
  brandTextOn: "#ffffff",
  sidebarActive: "#60a5fa",
  sidebarActiveBg: "#172a45",
  primary: "#60a5fa",
  primaryPressed: "#3b82f6",

  success: "#34d399",
  successSubtle: "#052e16",
  successText: "#86efac",
  warning: "#fbbf24",
  warningSubtle: "#422006",
  warningText: "#fcd34d",
  danger: "#f87171",
  dangerSubtle: "#450a0a",
  dangerText: "#fca5a5",
  info: "#60a5fa",
  infoSubtle: "#172554",
  infoText: "#93c5fd",

  homeMarketplaceBand: "#2a2410",
  skeletonShimmer: NEUTRALS_DARK.neutral200,
  drawerHeader: "#101018",
  chatSearchHighlight: "#4a4520",
  chatPresence: "#34d399",
  chatStatusMuted: "#9ca3af",
  chatStatusRead: "#60a5fa",
};

export type AppColors = typeof colorsLight;
