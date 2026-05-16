import type { Ionicons } from "@expo/vector-icons";
import type { AccountTypeValue } from "../../../../constants/accountType";

export type LockerTileId = "clips" | "gamePlans" | "savedLessons" | "invite";

export type LockerTileConfig = {
  id: LockerTileId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Accent palette for icon badge */
  accent: "navy" | "sky" | "amber" | "violet";
  roles: readonly AccountTypeValue[];
};

export type SessionPreviewProps = {
  session: Record<string, unknown>;
  accountType: string | null;
  onPress?: () => void;
};
