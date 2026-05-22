import { Alert } from "react-native";

/** Second-step confirm before declining an instant lesson (matches web trainer modal). */
export function confirmTrainerDecline(
  traineeName: string,
  onConfirm: () => void
): void {
  Alert.alert(
    "Decline lesson?",
    `Decline the instant lesson request from ${traineeName}? They will be notified that you are unavailable.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Decline lesson", style: "destructive", onPress: onConfirm },
    ]
  );
}
