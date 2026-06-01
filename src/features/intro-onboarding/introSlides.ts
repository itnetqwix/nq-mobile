import type { Ionicons } from "@expo/vector-icons";

export type IntroSlide = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  titleKey: string;
  bodyKey: string;
};

export const INTRO_SLIDES: readonly IntroSlide[] = [
  {
    id: "leap",
    icon: "trophy-outline",
    accent: "#6366f1",
    titleKey: "intro.slides.leap.title",
    bodyKey: "intro.slides.leap.body",
  },
  {
    id: "coaches",
    icon: "people-outline",
    accent: "#0ea5e9",
    titleKey: "intro.slides.coaches.title",
    bodyKey: "intro.slides.coaches.body",
  },
  {
    id: "live",
    icon: "videocam-outline",
    accent: "#16a34a",
    titleKey: "intro.slides.live.title",
    bodyKey: "intro.slides.live.body",
  },
] as const;
