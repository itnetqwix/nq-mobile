import { useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "../../../components/ui";
import { endSessionEarly } from "../../home/api/homeApi";
import { invalidateSessions, patchSessionInQueryCaches } from "../../../lib/queryInvalidation";
import {
  canEnterLesson,
  canPromptEarlySessionEnd,
} from "../../../lib/sessions/sessionUtils";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import type { RootStackParamList } from "../../../navigation/types";
import { colors, radii, space, typography } from "../../../theme";

type Props = {
  session: any;
  isTrainer: boolean;
  layout?: "row" | "column";
  size?: "md" | "sm";
  onActionComplete?: () => void;
};

export function SessionEarlyEndActions({
  session,
  isTrainer,
  layout = "column",
  size = "md",
  onActionComplete,
}: Props) {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [busy, setBusy] = useState(false);

  const sessionId = String(session?._id ?? session?.id ?? "");
  const show = canPromptEarlySessionEnd(session, isTrainer);
  const canRejoin = canEnterLesson(session);

  const handleEnd = useCallback(() => {
    if (!sessionId) return;
    Alert.alert(
      t("sessions.earlyEndTitle", { defaultValue: "End session early?" }),
      t("sessions.earlyEndBody", {
        defaultValue:
          "Confirm that your lesson has finished. The coach becomes available to book again for the rest of this time slot.",
      }),
      [
        { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
        {
          text: t("sessions.earlyEndConfirm", { defaultValue: "Yes, session ended" }),
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await endSessionEarly(sessionId);
              const patch = {
                ...(res?.session ?? {}),
                status: res?.session?.status ?? "completed",
              };
              patchSessionInQueryCaches(queryClient, sessionId, patch);
              invalidateSessions(queryClient);
              onActionComplete?.();
              Alert.alert(
                t("sessions.earlyEndSuccessTitle", { defaultValue: "Session ended" }),
                t(
                  isTrainer
                    ? "sessions.earlyEndSuccessTrainer"
                    : "sessions.earlyEndSuccessTrainee",
                  {
                    defaultValue: isTrainer
                      ? "You're available to book again for the remaining time in this slot."
                      : "Thanks for confirming. Your coach is available again for the rest of this time slot.",
                  }
                )
              );
            } catch (e: unknown) {
              const msg =
                e instanceof Error
                  ? e.message
                  : t("sessions.earlyEndFailed", { defaultValue: "Could not end session." });
              Alert.alert(
                t("sessions.earlyEndFailedTitle", { defaultValue: "Could not end session" }),
                msg
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }, [sessionId, isTrainer, queryClient, onActionComplete, t]);

  const handleRejoin = useCallback(() => {
    if (!sessionId || !canRejoin) return;
    navigation.navigate("Meeting", { lessonId: sessionId });
  }, [sessionId, canRejoin, navigation]);

  if (!show) return null;

  const isRow = layout === "row";

  return (
    <View style={[styles.wrap, isRow && styles.wrapRow]}>
      <Text style={styles.prompt}>
        {t("sessions.earlyEndPrompt", { defaultValue: "Has your session ended?" })}
      </Text>
      <View style={[styles.buttons, isRow && styles.buttonsRow]}>
        <Button
          label={
            busy
              ? t("sessions.earlyEndEnding", { defaultValue: "Ending…" })
              : t("sessions.earlyEndYes", { defaultValue: "Yes, session ended" })
          }
          variant="danger"
          leftIcon="checkmark-done-outline"
          onPress={handleEnd}
          disabled={busy}
          loading={busy}
          size={size}
          fullWidth={!isRow}
        />
        <Button
          label={t("sessions.rejoinSession", { defaultValue: "Rejoin session" })}
          variant="secondary"
          leftIcon="videocam-outline"
          onPress={handleRejoin}
          disabled={!canRejoin || busy}
          size={size}
          fullWidth={!isRow}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wrapRow: {
    flex: 1,
  },
  prompt: {
    ...typography.bodySm,
    color: colors.text,
    fontWeight: "600",
  },
  buttons: {
    gap: space.sm,
  },
  buttonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
