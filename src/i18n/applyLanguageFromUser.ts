import i18n from "./index";
import { normalizeAppLocale } from "./languages";
import { persistAppLocale } from "./localeStorage";

/**
 * When the profile includes `preferred_locale`, switch the app UI to match.
 * If the field is missing, leaves the current language unchanged (device or stored).
 */
export async function applyLanguageFromUser(user: Record<string, unknown> | null): Promise<void> {
  const pl = user?.preferred_locale;
  if (typeof pl !== "string" || !pl.trim()) return;
  const code = normalizeAppLocale(pl);
  await i18n.changeLanguage(code);
  await persistAppLocale(code);
}
