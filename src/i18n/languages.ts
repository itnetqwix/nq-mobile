export const APP_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "hi", label: "हिन्दी" },
] as const;

export type AppLanguageCode = (typeof APP_LANGUAGES)[number]["code"];

export function normalizeAppLocale(code: unknown): AppLanguageCode {
  const raw = typeof code === "string" ? code.trim().split("-")[0].toLowerCase() : "";
  const hit = APP_LANGUAGES.find((l) => l.code === raw);
  return hit?.code ?? "en";
}

export function languageLabelForCode(code: string): string {
  const c = normalizeAppLocale(code);
  return APP_LANGUAGES.find((l) => l.code === c)?.label ?? "English";
}
