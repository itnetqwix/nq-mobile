import React from "react";
import { ProfileAvatar } from "../../../../components/ui/ProfileAvatar";
import { useAvatarCacheBust } from "../../../../lib/avatarCacheBust";

type Props = {
  uri?: string;
  user?: Record<string, unknown> | null;
  name?: string;
  size?: number;
  onlineStatus?: "online" | "offline";
};

/** Dashboard home avatar — auto-refreshes after a profile picture upload. */
export function HomeUserAvatar(props: Props) {
  const cacheBust = useAvatarCacheBust();
  return <ProfileAvatar {...props} cacheBust={cacheBust || undefined} />;
}
