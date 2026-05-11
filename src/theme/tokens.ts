/**
 * Aligned with `nq-frontend-main` dashboard chrome:
 * - Brand navy on buttons / headers (`#000080` across trainee dashboard, booking, etc.)
 * - Left sidebar active state (`containers/leftSidebar/index.scss`: `#1976d2`, `#e3f2fd`)
 */
export const colors = {
  background: "#ffffff",
  surface: "#f6f7fb",
  text: "#111827",
  textSecondary: "#333333",
  textMuted: "#6b7280",
  /** Primary actions, headers — matches web NetQwix navy */
  brandNavy: "#000080",
  /** Sidebar / nav active icon & label — Material blue used on web left rail */
  sidebarActive: "#1976d2",
  sidebarActiveBg: "#e3f2fd",
  border: "#e5e7eb",
  tabBarBorder: "#e5e7eb",
  danger: "#dc2626",
  success: "#16a34a",
  /** Legacy alias: web often uses #2563eb for links; keep for gradual migration */
  primary: "#1976d2",
  primaryPressed: "#1565c0",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

export const layout = {
  /** Web compact left rail ~65px; drawer content uses comfortable width */
  drawerWidth: 300,
  /** Web expanded sidebar offset hint ~105px */
  sidebarRailCompact: 65,
  sidebarRailExpanded: 105,
} as const;
