/**
 * Barrel for the locale-aware formatting layer.
 *
 * Import from `"@/lib/intl"` (or relative path) rather than the individual
 * files; that way we can swap implementations later (e.g. ICU 4.x → 5.x,
 * Hermes Intl polyfill, etc.) without touching consumer code.
 */

export {
  APP_DISPLAY_CURRENCY,
  APP_DISPLAY_LOCALE,
  formatCurrency,
  formatCurrencyMinor,
  formatNumber,
  currencySymbol,
  getCurrencyForLocale,
  resolveFormattingLocale,
  useActiveCurrency,
  useCurrencyFormatter,
  useNumberFormatter,
} from "./currency";

export { getRoleTerm } from "./terminology";
