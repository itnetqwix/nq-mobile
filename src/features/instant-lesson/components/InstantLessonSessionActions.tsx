/**
 * Inline Accept / Decline for trainer instant pending sessions.
 */

import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button } from "../../../components/ui";
import { space } from "../../../theme";
import { isInstantLesson, isPendingBooking } from "../../../lib/sessions/sessionUtils";
import { useInstantLesson } from "../InstantLessonContext";

type Props = {
  session: Record<string, unknown>;
  layout?: "row" | "column";
  size?: "sm" | "md";
  onActionComplete?: () => void;
};

export function InstantLessonSessionActions({
  session,
  layout = "row",
  size = "sm",
  onActionComplete,
}: Props) {
  const { acceptInstantSession, declineInstantSession } = useInstantLesson();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const pending = isPendingBooking(session);
  const instant = isInstantLesson(session);
  if (!pending || !instant) return null;

  const handleAccept = async () => {
    setBusy("accept");
    try {
      await acceptInstantSession(session);
      onActionComplete?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "accept_failed";
      if (msg === "accept_timeout") {
        Alert.alert(
          "Accept timed out",
          "The server did not respond. Check your connection and try again."
        );
      } else if (msg !== "missing_session_ids" && msg !== "not_connected") {
        Alert.alert("Accept failed", "Could not accept this lesson. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    setBusy("decline");
    try {
      await declineInstantSession(session);
      onActionComplete?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "decline_failed";
      if (msg !== "missing_session_ids" && msg !== "not_connected") {
        Alert.alert("Decline failed", "Could not decline this lesson. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, layout === "column" && styles.column]}>
      <Button
        label={busy === "accept" ? "Accepting…" : "Accept"}
        leftIcon="checkmark-circle-outline"
        size={size}
        fullWidth={false}
        onPress={handleAccept}
        disabled={!!busy}
        loading={busy === "accept"}
      />
      <Button
        label="Decline"
        variant="danger"
        leftIcon="close-circle-outline"
        size={size}
        fullWidth={false}
        onPress={handleDecline}
        disabled={!!busy}
        loading={busy === "decline"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  column: {
    flexDirection: "column",
    alignItems: "stretch",
  },
});
