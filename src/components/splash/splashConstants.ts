/** Minimum time the branded splash stays visible (feels intentional, not a flash). */
export const SPLASH_MIN_DISPLAY_MS = 900;

/** Hard cap — never block launch longer than this. */
export const SPLASH_MAX_WAIT_MS = 8_000;

/** Exit fade before revealing the app shell. */
export const SPLASH_EXIT_ANIMATION_MS = 280;

/** Cold-start splash — light brand wash (not dark navy). */
export const SPLASH_BG_LIGHT = "#E8F1FF";
export const SPLASH_BG_LIGHT_TOP = "#F4F8FF";
export const SPLASH_ACCENT = "#1976d2";
export const SPLASH_TEXT = "#0F2B5B";
export const SPLASH_TEXT_MUTED = "#5B6F8C";

/** @deprecated Use SPLASH_BG_LIGHT — kept for native splash migration. */
export const SPLASH_BRAND_NAVY = "#000080";
