import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../../components/ui";
import { ProfileAvatar } from "../../../components/ui/ProfileAvatar";
import { PublicSocialLinksRow } from "../../../components/social/PublicSocialLinksRow";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../theme";

type Props = {
  visible: boolean;
  trainee: Record<string, unknown> | null;
  onDismiss: () => void;
  onMessage?: () => void;
  onNudge?: () => void;
  messageBusy?: boolean;
  nudgeBusy?: boolean;
};

export function TraineeProfileModal({
  visible,
  trainee,
  onDismiss,
  onMessage,
  onNudge,
  messageBusy,
  nudgeBusy,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();

  if (!trainee) return null;

  const name = String(trainee.fullname ?? trainee.fullName ?? t("trainees.studentDefault"));
  const email = String(trainee.email ?? "");
  const bio = String(trainee.bio ?? "").trim();
  const joined = trainee.createdAt
    ? new Date(String(trainee.createdAt)).toLocaleDateString()
    : "";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 8), backgroundColor: c.surface }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button">
            <Ionicons name="chevron-down" size={28} color={c.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.text }]}>
            {t("trainees.profileTitle", { defaultValue: "Trainee profile" })}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <ProfileAvatar user={trainee} name={name} size={80} />
            <View style={styles.heroBody}>
              <Text style={[styles.name, { color: c.text }]}>{name}</Text>
              {!!email && (
                <Text style={[styles.email, { color: c.textMuted }]} numberOfLines={1}>
                  {email}
                </Text>
              )}
              {!!joined && (
                <View style={styles.joinedRow}>
                  <Ionicons name="calendar-outline" size={13} color={c.textMuted} />
                  <Text style={[styles.joinedText, { color: c.textMuted }]}>
                    {t("trainees.joined", { date: joined })}
                  </Text>
                </View>
              )}
              <PublicSocialLinksRow user={trainee} size="md" />
            </View>
          </View>

          {!!bio && (
            <View style={[styles.block, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
              <Text style={[styles.blockTitle, { color: c.text }]}>
                {t("profile.bioLabel", { defaultValue: "Bio" })}
              </Text>
              <Text style={[styles.bodyText, { color: c.textSecondary }]}>{bio}</Text>
            </View>
          )}

          {(onMessage || onNudge) && (
            <View style={styles.actions}>
              {onMessage ? (
                <View style={{ flex: 1 }}>
                  <Button
                    label={t("trainees.message", { defaultValue: "Message" })}
                    variant="secondary"
                    leftIcon="chatbubble-outline"
                    loading={messageBusy}
                    onPress={onMessage}
                  />
                </View>
              ) : null}
              {onNudge ? (
                <View style={{ flex: 1 }}>
                  <Button
                    label={t("trainees.nudgeBook", { defaultValue: "Nudge" })}
                    leftIcon="paper-plane-outline"
                    loading={nudgeBusy}
                    onPress={onNudge}
                  />
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { ...typography.titleSm },
  content: { paddingHorizontal: space.md, paddingTop: space.md },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    marginBottom: space.md,
  },
  heroBody: { flex: 1, minWidth: 0 },
  name: { ...typography.titleSm, fontWeight: "800" },
  email: { ...typography.bodySm, marginTop: 2 },
  joinedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  joinedText: { ...typography.caption },
  block: {
    padding: space.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: space.md,
  },
  blockTitle: { ...typography.bodyMd, fontWeight: "700", marginBottom: 6 },
  bodyText: { ...typography.bodyMd, lineHeight: 22 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
});
