import { introImages } from "../../constants/images";

export type IntroSlide = {
  id: string;
  image: (typeof introImages)[keyof typeof introImages];
  titleKey: string;
  bodyKey: string;
};

export const INTRO_SLIDES: readonly IntroSlide[] = [
  {
    id: "leap",
    image: introImages.leap,
    titleKey: "intro.slides.leap.title",
    bodyKey: "intro.slides.leap.body",
  },
  {
    id: "coaches",
    image: introImages.coaches,
    titleKey: "intro.slides.coaches.title",
    bodyKey: "intro.slides.coaches.body",
  },
  {
    id: "live",
    image: introImages.live,
    titleKey: "intro.slides.live.title",
    bodyKey: "intro.slides.live.body",
  },
] as const;
