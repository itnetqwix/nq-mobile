import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IonName = ComponentProps<typeof Ionicons>["name"];

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
  cricket: "baseball-outline",
  lacrosse: "american-football-outline",
  softball: "baseball-outline",
  pickleball: "tennisball-outline",
  skiing: "snow-outline",
  snowboarding: "snow-outline",
};

export function getCategoryIcon(category: string): IonName {
  const key = category.toLowerCase().replace(/[^a-z]/g, "");
  for (const [fragment, icon] of Object.entries(ICON_MAP)) {
    if (key.includes(fragment)) return icon;
  }
  return "trophy-outline";
}
