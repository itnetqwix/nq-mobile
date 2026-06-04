import { Alert, Share } from "react-native";
import { WEB_APP_ORIGIN } from "../../../config/env";

export async function shareClipExternally(params: {
  title: string;
  clipId?: string;
  playbackUrl?: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const link = params.playbackUrl?.trim()
    ? params.playbackUrl
    : params.clipId
      ? `${WEB_APP_ORIGIN}/clips/${encodeURIComponent(params.clipId)}`
      : WEB_APP_ORIGIN;
  const message = params.t("locker.externalShareMessage", {
    defaultValue: "Check out this clip on NetQwix: {{title}}\n{{link}}",
    title: params.title,
    link,
  });
  try {
    await Share.share({ message, url: link });
  } catch {
    Alert.alert(params.t("locker.shareFailedTitle"), message);
  }
}
