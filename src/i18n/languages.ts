export const APP_LANGUAGES = [
  { code: "en", label: "English", bcp47: "en" },
  { code: "fr", label: "Français", bcp47: "fr" },
  { code: "es", label: "Español", bcp47: "es" },
  { code: "ar", label: "العربية", bcp47: "ar" },
  { code: "ja", label: "日本語", bcp47: "ja" },
  { code: "zh", label: "中文 (简体)", bcp47: "zh-CN" },
  { code: "ko", label: "한국어", bcp47: "ko" },
  { code: "de", label: "Deutsch", bcp47: "de" },
  { code: "ru", label: "Русский", bcp47: "ru" },
] as const;

export type AppLanguageCode = (typeof APP_LANGUAGES)[number]["code"];

const SUPPORTED = new Set<string>(APP_LANGUAGES.map((l) => l.code));

export function normalizeAppLocale(code: unknown): AppLanguageCode {
  const raw = typeof code === "string" ? code.trim().toLowerCase() : "";
  const base = raw.split("-")[0];
  if (SUPPORTED.has(base)) return base as AppLanguageCode;
  return "en";
}

export function languageLabelForCode(code: string): string {
  const c = normalizeAppLocale(code);
  return APP_LANGUAGES.find((l) => l.code === c)?.label ?? "English";
}

export function bcp47ForAppLocale(code: string): string {
  const c = normalizeAppLocale(code);
  return APP_LANGUAGES.find((l) => l.code === c)?.bcp47 ?? "en";
}
