import React from "react";
import { ProfileAvatar } from "../../../../components/ui/ProfileAvatar";

type Props = {
  uri?: string;
  user?: Record<string, unknown> | null;
  name?: string;
  size?: number;
  onlineStatus?: "online" | "offline";
};

/** Dashboard home avatar — uses shared {@link ProfileAvatar}. */
export function HomeUserAvatar(props: Props) {
  return <ProfileAvatar {...props} />;
}
