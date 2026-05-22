import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IonName = ComponentProps<typeof Ionicons>["name"];

/** Keyword fragments → icon. New DB categories match via substring (no app release needed). */
const ICON_MAP: Record<string, IonName> = {
  golf: "golf-outline",
  baseball: "baseball-outline",
  basketball: "basketball-outline",
  football: "american-football-outline",
  soccer: "football-outline",
  tennis: "tennisball-outline",
  volleyball: "basketball-outline",
  hockey: "snow-outline",
  swimming: "water-outline",
  running: "walk-outline",
  cycling: "bicycle-outline",
  boxing: "fitness-outline",
  martial: "fitness-outline",
  yoga: "body-outline",
  fitness: "barbell-outline",
  personaltraining: "barbell-outline",
  physicaltherapy: "medkit-outline",
  cricket: "baseball-outline",
  lacrosse: "american-football-outline",
  softball: "baseball-outline",
  pickleball: "tennisball-outline",
  skiing: "snow-outline",
  snowboarding: "snow-outline",
  acting: "film-outline",
  music: "musical-notes-outline",
  singing: "mic-outline",
  piano: "musical-notes-outline",
  guitar: "musical-notes-outline",
  drums: "musical-notes-outline",
  gymnastics: "body-outline",
  mentalhealth: "heart-outline",
  dance: "happy-outline",
  photography: "camera-outline",
  videoediting: "videocam-outline",
  graphicdesign: "color-palette-outline",
  coding: "code-slash-outline",
  webdevelopment: "globe-outline",
  appdevelopment: "phone-portrait-outline",
  uiux: "layers-outline",
  uiuxdesign: "layers-outline",
  digitalmarketing: "megaphone-outline",
  publicspeaking: "mic-outline",
  language: "language-outline",
  languagelearning: "language-outline",
  cooking: "restaurant-outline",
  chess: "grid-outline",
  meditation: "leaf-outline",
  nutrition: "nutrition-outline",
  careercoaching: "briefcase-outline",
  businesscoaching: "business-outline",
  finance: "cash-outline",
  makeup: "sparkles-outline",
  fashion: "shirt-outline",
  fashiondesign: "shirt-outline",
};

export function getCategoryIcon(category: string): IonName {
  const key = category.toLowerCase().replace(/[^a-z]/g, "");
  for (const [fragment, icon] of Object.entries(ICON_MAP)) {
    if (key.includes(fragment)) return icon;
  }
  return "trophy-outline";
}
