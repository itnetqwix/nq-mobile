import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { normalizeAppLocale } from "./languages";
import en from "./locales/en.json";
import es from "./locales/es.json";
import hi from "./locales/hi.json";

const deviceTag = Localization.getLocales()[0]?.languageTag ?? "en";
const initialLng = normalizeAppLocale(deviceTag.split("-")[0]);

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: en },
    es: { translation: es },
    hi: { translation: hi },
  },
  lng: initialLng,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
