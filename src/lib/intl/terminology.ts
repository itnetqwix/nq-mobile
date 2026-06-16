/**
 * Tutor / Trainer terminology resolution.
 *
 * Different markets use different words for the same role — "coach" feels
 * natural in the US, "tutor" in the UK / IN, "Lehrer/in" in DE. We can't
 * just translate "trainer" because the *concept* sometimes differs.
 *
 * The mapping is intentionally per-language. Override anywhere via i18n by
 * supplying `terminology.trainer` / `terminology.trainerPlural` etc.
 */

import i18n from "i18next";

type TerminologyKey = "trainer" | "trainerPlural" | "trainee" | "traineePlural";

const FALLBACKS: Record<string, Record<TerminologyKey, string>> = {
  en: { trainer: "Expert", trainerPlural: "Experts", trainee: "Enthusiast", traineePlural: "Enthusiasts" },
  fr: { trainer: "Coach", trainerPlural: "Coachs", trainee: "Élève", traineePlural: "Élèves" },
  es: { trainer: "Entrenador", trainerPlural: "Entrenadores", trainee: "Alumno", traineePlural: "Alumnos" },
  ar: { trainer: "مدرب", trainerPlural: "مدربون", trainee: "متدرب", traineePlural: "متدربون" },
  ja: { trainer: "コーチ", trainerPlural: "コーチ", trainee: "受講者", traineePlural: "受講者" },
  zh: { trainer: "教练", trainerPlural: "教练", trainee: "学员", traineePlural: "学员" },
  ko: { trainer: "코치", trainerPlural: "코치", trainee: "수강생", traineePlural: "수강생" },
  de: { trainer: "Trainer/in", trainerPlural: "Trainer/innen", trainee: "Schüler/in", traineePlural: "Schüler/innen" },
  ru: { trainer: "Тренер", trainerPlural: "Тренеры", trainee: "Ученик", traineePlural: "Ученики" },
};

/**
 * Resolve a role term for the current i18n language. The lookup chain is:
 *   1. i18n key `terminology.{key}` (per-locale override).
 *   2. Hard-coded fallback table for the current language.
 *   3. English fallback table.
 *
 * This means a market that wants "expert" instead of the default can just
 * ship `"terminology": { "trainer": "Expert" }` in their locale file
 * without touching any code.
 */
export function getRoleTerm(key: TerminologyKey): string {
  const i18nKey = `terminology.${key}`;
  const fromI18n = i18n.t(i18nKey, { defaultValue: "" });
  if (typeof fromI18n === "string" && fromI18n && fromI18n !== i18nKey) {
    return fromI18n;
  }
  const lang = (i18n.language ?? "en").split("-")[0];
  return FALLBACKS[lang]?.[key] ?? FALLBACKS.en[key];
}
