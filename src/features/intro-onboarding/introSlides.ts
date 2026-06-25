import { introImages } from "../../constants/images";

export type IntroSlide = {
  id: string;
  image: (typeof introImages)[keyof typeof introImages];
  titleKey: string;
  bodyKey: string;
  badgeKey: string;
  icon: "trending-up" | "people" | "videocam";
  accent: string;
};

export const INTRO_SLIDES: readonly IntroSlide[] = [
  {
    id: "leap",
    image: introImages.leap,
    titleKey: "intro.slides.leap.title",
    bodyKey: "intro.slides.leap.body",
    badgeKey: "intro.slides.leap.badge",
    icon: "trending-up",
    accent: "#1976D2",
  },
  {
    id: "coaches",
    image: introImages.coaches,
    titleKey: "intro.slides.coaches.title",
    bodyKey: "intro.slides.coaches.body",
    badgeKey: "intro.slides.coaches.badge",
    icon: "people",
    accent: "#0F2B5B",
  },
  {
    id: "live",
    image: introImages.live,
    titleKey: "intro.slides.live.title",
    bodyKey: "intro.slides.live.body",
    badgeKey: "intro.slides.live.badge",
    icon: "videocam",
    accent: "#2E7D32",
  },
] as const;
