import { I18nManager } from "react-native";

/** Apply RTL when Arabic is selected. Returns true if app reload is recommended. */
export function applyRtlLocale(locale: string): boolean {
  const isRtl = locale === "ar";
  if (I18nManager.isRTL === isRtl) return false;
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(isRtl);
  return true;
}
