import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../../../components/ui";
import { AccountType } from "../../../../constants/accountType";
import { canEnterLesson, formatSessionWhen } from "../../../../lib/sessions/sessionUtils";
import { navigationRef } from "../../../../navigation/navigationRef";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { HomeUserAvatar } from "../home/HomeUserAvatar";

type Props = {
  session: Record<string, unknown>;
  onOpenSession?: () => void;
};

export function ContinueWhereYouLeftOffCard({ session, onOpenSession }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const other = (session.trainer_info ?? session.trainerInfo) as Record<string, unknown> | undefined;
  const name = String(other?.fullname ?? other?.fullName ?? "Coach");
  const category = String(other?.category ?? session.category ?? "");
  const { dateLabel, timeLabel } = formatSessionWhen(session);
  const lessonId = String(session._id ?? session.id ?? "");
  const canJoin = canEnterLesson(session);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{t("traineeDiscover.continueTitle")}</Text>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
        onPress={onOpenSession}
        disabled={!onOpenSession}
      >
        <HomeUserAvatar uri={other?.profile_picture as string} name={name} size={56} />
        <View style={styles.meta}>
          <Text style={styles.name}>{t("traineeDiscover.continueWith", { name })}</Text>
          {!!category && <Text style={styles.sub}>{category}</Text>}
          {!!dateLabel && (
            <Text style={styles.sub}>
              {dateLabel}{timeLabel ? ` · ${timeLabel}` : ""}
            </Text>
          )}
        </View>
        {onOpenSession ? <Ionicons name="chevron-forward" size={20} color={c.textMuted} /> : null}
      </Pressable>
      {canJoin && lessonId ? (
        <Button
          label={t("traineeDiscover.joinNow")}
          leftIcon="videocam-outline"
          size="sm"
          onPress={() => {
            if (navigationRef.isReady()) {
              navigationRef.navigate("Meeting", { lessonId });
            }
          }}
        />
      ) : null}
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      card: {
        backgroundColor: palette.brandSubtle,
        borderRadius: radii.lg,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.brandNavy,
      },
      kicker: { ...typography.caption, color: palette.brandNavy, fontWeight: "700", marginBottom: space.sm },
      row: { flexDirection: "row", alignItems: "center", gap: space.md },
      meta: { flex: 1, minWidth: 0 },
      name: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      sub: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
    })
  );
}
