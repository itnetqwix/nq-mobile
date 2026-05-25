import { I18nManager } from "react-native";

/**
 * RTL languages we ship today. Add any new right-to-left BCP-47 root here;
 * the helper below only flips `I18nManager` when the locale is in this set,
 * which means accidental tag drift (`ar-EG-uXuy`) still RTLs correctly.
 */
const RTL_LANGUAGE_ROOTS = new Set<string>(["ar", "he", "fa", "ur"]);

function isRtlLocale(locale: string): boolean {
  const root = (locale ?? "en").split("-")[0]?.toLowerCase() ?? "en";
  return RTL_LANGUAGE_ROOTS.has(root);
}

/**
 * Apply RTL when an RTL locale is selected. Returns `true` if a reload is
 * recommended (RN's `forceRTL` only takes effect on the next launch).
 *
 * We call `allowRTL(true)` *unconditionally* so users can preview the RTL
 * mirror via developer toggles even when the runtime locale is LTR — the
 * subsequent `forceRTL(false)` keeps the actual app left-to-right until
 * they pick Arabic. Without `allowRTL(true)` first, `forceRTL(true)` is a
 * no-op on Android in release mode.
 */
export function applyRtlLocale(locale: string): boolean {
  const wantRtl = isRtlLocale(locale);
  // Always allow RTL — without this Android release builds ignore subsequent forceRTL calls.
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL === wantRtl) return false;
  I18nManager.forceRTL(wantRtl);
  return true;
}

/** Re-export so screens can show "switching to Arabic requires restart" hints. */
export function localeRequiresRtlReload(locale: string): boolean {
  return isRtlLocale(locale) !== I18nManager.isRTL;
}
