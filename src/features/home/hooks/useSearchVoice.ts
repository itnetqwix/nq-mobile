import { useCallback } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useVoiceInput } from "../../ai/useVoiceInput";

/** Voice-to-text for marketplace coach search (reuses AI transcription). */
export function useSearchVoice(onTranscript: (text: string) => void) {
  const { t } = useTranslation();

  const voice = useVoiceInput({
    maxDurationMs: 12_000,
    onResult: (result) => {
      if (result.error === "permission") {
        Alert.alert(
          t("homeMarketplace.voice.permissionTitle", { defaultValue: "Microphone needed" }),
          t("homeMarketplace.voice.permissionBody", {
            defaultValue: "Allow microphone access in Settings to search by voice.",
          })
        );
        return;
      }
      if (result.error || !result.text?.trim()) {
        Alert.alert(
          t("homeMarketplace.voice.failedTitle", { defaultValue: "Couldn't hear that" }),
          t("homeMarketplace.voice.failedBody", {
            defaultValue: "Try again or type your search.",
          })
        );
        return;
      }
      onTranscript(result.text.trim());
    },
  });

  const toggle = useCallback(() => {
    if (voice.state === "idle") void voice.start();
    else if (voice.state === "recording") void voice.stop();
  }, [voice]);

  return { voice, toggle };
}
