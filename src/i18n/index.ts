import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { applyRtlLocale } from "./applyRtlLocale";
import { normalizeAppLocale } from "./languages";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import ar from "./locales/ar.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import ko from "./locales/ko.json";
import de from "./locales/de.json";
import ru from "./locales/ru.json";

const deviceTag = Localization.getLocales()[0]?.languageTag ?? "en";
const initialLng = normalizeAppLocale(deviceTag.split("-")[0]);
applyRtlLocale(initialLng);

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    es: { translation: es },
    ar: { translation: ar },
    ja: { translation: ja },
    zh: { translation: zh },
    ko: { translation: ko },
    de: { translation: de },
    ru: { translation: ru },
  },
  lng: initialLng,
  fallbackLng: "en",
  /** Show the key only when missing in every language bundle (en is complete). */
  returnNull: false,
  interpolation: { escapeValue: false },
});

export default i18n;
