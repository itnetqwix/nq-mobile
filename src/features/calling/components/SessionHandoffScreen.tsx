import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../../components/ui";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";
import type { SessionHandoffSummary } from "../sessionLiveApi";

type Props = {
  visible: boolean;
  loading: boolean;
  summary: SessionHandoffSummary | null;
  isTrainer: boolean;
  onRate: () => void;
  onRebook?: () => void;
  onDone: () => void;
};

export function SessionHandoffScreen({
  visible,
  loading,
  summary,
  isTrainer,
  onRate,
  onRebook,
  onDone,
}: Props) {
  const c = useThemeColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.shell, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <Text style={[styles.title, { color: c.text }]}>Session complete</Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          {summary?.peer?.fullname
            ? `Lesson with ${summary.peer.fullname}`
            : "Here’s a quick summary of your lesson."}
        </Text>

        {loading ? (
          <ActivityIndicator color={c.brandNavy} style={{ marginTop: 24 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.cards} showsVerticalScrollIndicator={false}>
            <StatCard
              icon="time-outline"
              label="Duration"
              value={
                summary?.duration_minutes
                  ? `${summary.duration_minutes} min booked`
                  : "—"
              }
            />
            {summary?.total_extended_minutes ? (
              <StatCard
                icon="add-circle-outline"
                label="Extended"
                value={`+${summary.total_extended_minutes} min`}
              />
            ) : null}
            {summary?.clips_reviewed_count ? (
              <StatCard
                icon="film-outline"
                label="Clips attached"
                value={`${summary.clips_reviewed_count}`}
              />
            ) : null}
            {!isTrainer && summary?.shared_notes?.length ? (
              <View style={[styles.notesCard, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
                <Text style={[styles.notesTitle, { color: c.text }]}>Coach notes</Text>
                {summary.shared_notes.map((n, i) => (
                  <Text key={`${i}-${n.text.slice(0, 12)}`} style={[styles.noteLine, { color: c.textMuted }]}>
                    · {n.text}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>
        )}

        <View style={styles.actions}>
          {summary?.can_rate ? (
            <Button label="Rate session" leftIcon="star-outline" onPress={onRate} />
          ) : null}
          {!isTrainer && summary?.can_rebook && onRebook ? (
            <Button label="Book again" variant="secondary" leftIcon="calendar-outline" onPress={onRebook} />
          ) : null}
          <Button label="Done" variant="ghost" onPress={onDone} />
        </View>
      </View>
    </Modal>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  const c = useThemeColors();
  const styles = useStyles();
  return (
    <View style={[styles.statCard, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
      <Ionicons name={icon} size={18} color={c.brandNavy} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
        <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      shell: { flex: 1, backgroundColor: palette.background, paddingHorizontal: space.md },
      title: { ...typography.titleMd, fontWeight: "800" },
      sub: { ...typography.bodySm, marginTop: 4, marginBottom: space.md },
      cards: { gap: space.sm, paddingBottom: space.md },
      statCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: space.md,
        borderRadius: radii.md,
        borderWidth: 1,
      },
      statLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
      statValue: { ...typography.bodyMd, fontWeight: "700", marginTop: 2 },
      notesCard: {
        padding: space.md,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: 6,
      },
      notesTitle: { ...typography.subtitle, fontWeight: "700" },
      noteLine: { ...typography.bodySm },
      actions: { gap: space.sm, marginTop: "auto" },
    })
  );
}
