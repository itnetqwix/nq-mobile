/**
 * Locale-aware currency + number formatting.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a single library?
 *   Until now we sprinkled `` `$${n.toFixed(2)}` `` across the codebase, which
 *   (a) hard-codes USD even for users in IN / EU / JP, (b) ignores locale
 *   grouping (1,00,000 in India vs. 100,000 in the US), and (c) can't render
 *   negative / accounting forms consistently. This module centralises every
 *   money + number string we produce.
 *
 * Order of precedence for picking a currency:
 *   1. Explicit `currency` argument (e.g. server-issued wallet/balance).
 *   2. {@link getCurrencyForLocale} mapping based on the current i18n
 *      language tag.
 *   3. Device region currency from `expo-localization` (e.g. iPhone set to
 *      English but with India region → INR).
 *   4. USD as a final fallback.
 *
 * All public helpers wrap `Intl.NumberFormat` (Hermes ships ICU). Failures
 * fall back to a hand-rolled formatter so the app never crashes if a runtime
 * lacks Intl data for a specific code.
 */

import * as Localization from "expo-localization";
import i18n from "i18next";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/** NetQwix currently prices and displays trainee checkout in USD. */
export const APP_DISPLAY_CURRENCY = "USD";
export const APP_DISPLAY_LOCALE = "en-US";

/**
 * BCP-47 → ISO-4217 currency map for our supported locales.
 *
 * We intentionally only include languages we ship UI for. Anything outside
 * this map either uses the device region (via `expo-localization`) or
 * falls back to USD — never silently render a `?` symbol.
 */
const LOCALE_TO_CURRENCY: Record<string, string> = {
  en: "USD",
  "en-US": "USD",
  "en-GB": "GBP",
  "en-IN": "INR",
  "en-CA": "CAD",
  "en-AU": "AUD",
  fr: "EUR",
  "fr-CA": "CAD",
  es: "EUR",
  "es-MX": "MXN",
  "es-AR": "ARS",
  de: "EUR",
  ar: "AED",
  "ar-SA": "SAR",
  "ar-EG": "EGP",
  ja: "JPY",
  zh: "CNY",
  "zh-TW": "TWD",
  "zh-HK": "HKD",
  ko: "KRW",
  ru: "RUB",
  hi: "INR",
};

/**
 * Currencies with no minor units (¥ 100 = ¥ 100, not ¥ 100.00). We use this
 * to decide whether the *display* precision is 0 or 2 — independent of how
 * the backend stores the amount in minor units.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY",
  "KRW",
  "VND",
  "IDR",
  "CLP",
  "TWD",
]);

/**
 * Resolve an ISO-4217 currency code from a locale string.
 *
 * Tries the full tag (`en-IN`) first, then the language only (`en`). Falls
 * back to the device region currency if the locale isn't in our map.
 */
export function getCurrencyForLocale(locale: string | null | undefined): string {
  if (locale) {
    const tag = locale.replace("_", "-");
    if (LOCALE_TO_CURRENCY[tag]) return LOCALE_TO_CURRENCY[tag];
    const base = tag.split("-")[0];
    if (LOCALE_TO_CURRENCY[base]) return LOCALE_TO_CURRENCY[base];
  }
  try {
    const deviceCurrency = Localization.getLocales()[0]?.currencyCode;
    if (deviceCurrency) return deviceCurrency;
  } catch {
    /* expo-localization not ready (server / test) */
  }
  return "USD";
}

/**
 * Get the user-facing BCP-47 tag we should format numbers with. Combines
 * the current i18n language with the device region so a US user reading
 * the app in French still sees "$1,234.56" — not "1 234,56 $US".
 *
 * If you need *just* the app language, read `i18n.language` directly.
 */
export function resolveFormattingLocale(language?: string): string {
  const lang = (language ?? i18n.language ?? "en").split("-")[0];
  try {
    const region = Localization.getLocales()[0]?.regionCode;
    if (region) return `${lang}-${region}`;
  } catch {
    /* fall through to bare lang tag */
  }
  return lang;
}

type FormatCurrencyOptions = {
  /** ISO-4217 code. Defaults to the locale's mapped currency. */
  currency?: string;
  /**
   * Force a number of fractional digits. Defaults to currency-aware: 0 for
   * yen / won, 2 elsewhere.
   */
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  /** Pass `accounting` to render negative as `($1.23)` per finance UX. */
  currencySign?: "standard" | "accounting";
  /** Optional override of the BCP-47 tag (e.g. for trainer-side payouts). */
  locale?: string;
};

/**
 * Format a money amount as a locale-aware string.
 *
 *   formatCurrency(1234.5)                  → "$1,234.50" (en-US)
 *   formatCurrency(100000, { currency: "INR" }) → "₹1,00,000.00" (en-IN)
 *   formatCurrency(980, { currency: "JPY" }) → "¥980"
 *
 * Always pass amounts as **major units** (dollars, not cents). Callers that
 * have minor units should divide by 100 first — see {@link formatCurrencyMinor}.
 */
export function formatCurrency(
  amount: number | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const value = Number(amount ?? 0);
  const locale = options.locale ?? resolveFormattingLocale();
  const currency =
    options.currency ?? getCurrencyForLocale(locale);
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());

  const minimumFractionDigits =
    options.minimumFractionDigits ?? (isZeroDecimal ? 0 : 2);
  const maximumFractionDigits =
    options.maximumFractionDigits ?? minimumFractionDigits;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencySign: options.currencySign,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);
  } catch {
    return fallbackCurrencyFormat(value, currency, {
      minimumFractionDigits,
      maximumFractionDigits,
    });
  }
}

/**
 * Convenience wrapper for backend amounts that are denominated in minor
 * units (cents, paise). Equivalent to `formatCurrency(minor / 100, ...)`.
 */
export function formatCurrencyMinor(
  minor: number | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const currency = (
    options.currency ?? getCurrencyForLocale(options.locale ?? resolveFormattingLocale())
  ).toUpperCase();
  const divisor = ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
  return formatCurrency(Number(minor ?? 0) / divisor, { ...options, currency });
}

type FormatNumberOptions = {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Useful for "5 sessions / 3 friends" pluralised counts. */
  notation?: "standard" | "compact";
};

/**
 * Format a plain number with locale-aware grouping. Used for non-money UI
 * (session counts, viewer counts, kilo / mega summaries).
 *
 *   formatNumber(100000)              → "100,000" (en-US)
 *   formatNumber(100000, { locale: "en-IN" }) → "1,00,000"
 *   formatNumber(12500, { notation: "compact" }) → "12.5K"
 */
export function formatNumber(
  value: number | null | undefined,
  options: FormatNumberOptions = {}
): string {
  const num = Number(value ?? 0);
  const locale = options.locale ?? resolveFormattingLocale();
  try {
    return new Intl.NumberFormat(locale, {
      notation: options.notation,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits:
        options.maximumFractionDigits ??
        (options.notation === "compact" ? 1 : 2),
    }).format(num);
  } catch {
    return String(num);
  }
}

/**
 * Return just the currency symbol for a code (e.g. "₹", "$", "€"). Used by
 * compact UI like top-up presets that show "$25" without the trailing zeros.
 */
export function currencySymbol(currency?: string, locale?: string): string {
  const code = (currency ?? getCurrencyForLocale(locale ?? resolveFormattingLocale())).toUpperCase();
  const tag = locale ?? resolveFormattingLocale();
  try {
    const parts = new Intl.NumberFormat(tag, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === "currency")?.value;
    if (sym) return sym;
  } catch {
    /* fall through to manual table */
  }
  return CURRENCY_SYMBOL_FALLBACK[code] ?? code;
}

/**
 * Symbol table used when `Intl.NumberFormat.formatToParts` is unavailable
 * (very old Hermes builds, certain browsers). Kept minimal — anything not
 * here just renders the ISO code, which is still readable.
 */
const CURRENCY_SYMBOL_FALLBACK: Record<string, string> = {
  USD: "$",
  CAD: "$",
  AUD: "$",
  MXN: "$",
  ARS: "$",
  GBP: "£",
  EUR: "€",
  INR: "₹",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
  RUB: "₽",
  AED: "د.إ",
  SAR: "﷼",
  EGP: "ج.م",
  TWD: "NT$",
  HKD: "HK$",
};

/**
 * Last-resort formatter when Intl throws — keeps the *shape* of the number
 * even if the locale-specific grouping is wrong. Better than crashing.
 */
function fallbackCurrencyFormat(
  value: number,
  currency: string,
  {
    minimumFractionDigits,
    maximumFractionDigits,
  }: { minimumFractionDigits: number; maximumFractionDigits: number }
): string {
  const sym = CURRENCY_SYMBOL_FALLBACK[currency.toUpperCase()] ?? currency.toUpperCase();
  const fixed = value.toFixed(maximumFractionDigits);
  const trimmed =
    minimumFractionDigits === 0
      ? fixed.replace(/\.?0+$/, "")
      : fixed;
  return `${sym}${trimmed}`;
}

/**
 * React hook returning a memoised currency formatter bound to the current
 * i18n language. Re-creates only when language changes, so call sites can
 * use it inside render without worrying about perf.
 *
 *   const fmt = useCurrencyFormatter();
 *   <Text>{fmt(amount, { currency: balance?.currency })}</Text>
 */
export function useCurrencyFormatter(): (
  amount: number | null | undefined,
  options?: FormatCurrencyOptions
) => string {
  return useCallback(
    (amount: number | null | undefined, options: FormatCurrencyOptions = {}) =>
      formatCurrency(amount, {
        ...options,
        currency: options.currency ?? APP_DISPLAY_CURRENCY,
        locale: options.locale ?? APP_DISPLAY_LOCALE,
      }),
    []
  );
}

/**
 * Hook returning the active currency code (e.g. "USD", "INR") — used by
 * surfaces that need to *display* the code itself or pass it back to the
 * server (top-up creation, withdraw requests).
 */
export function useActiveCurrency(_serverCurrency?: string | null): string {
  return APP_DISPLAY_CURRENCY;
}

/**
 * Hook returning a number formatter (non-monetary). Same memoisation
 * strategy as {@link useCurrencyFormatter}.
 */
export function useNumberFormatter(): (
  value: number | null | undefined,
  options?: FormatNumberOptions
) => string {
  const { i18n: inst } = useTranslation();
  const language = inst.language;
  return useCallback(
    (value: number | null | undefined, options: FormatNumberOptions = {}) =>
      formatNumber(value, { ...options, locale: options.locale ?? resolveFormattingLocale(language) }),
    [language]
  );
}
