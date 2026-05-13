import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, EmptyState } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { useQuery } from "@tanstack/react-query";
import { fetchScheduledMeetings } from "../../home/api/homeApi";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";

function isSessionLiveNow(session: any): boolean {
  if (!session?.booked_date || !session?.start_time || !session?.end_time) return false;
  try {
    const now = new Date();
    const [sh, sm] = session.start_time.split(":").map(Number);
    const [eh, em] = session.end_time.split(":").map(Number);
    const [dy, dm, dd] = session.booked_date.split("-").map(Number);
    const start = new Date(dy, dm - 1, dd, sh, sm);
    const end = new Date(dy, dm - 1, dd, eh, em);
    if (start > end) end.setDate(end.getDate() + 1);
    return now >= start && now <= end;
  } catch {
    return false;
  }
}

export function MeetingRoomScreen() {
  const { accountType } = useAuth();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", "upcoming"],
    queryFn: () => fetchScheduledMeetings("upcoming"),
    staleTime: 30_000,
  });

  const liveSessions = sessions.filter(isSessionLiveNow);

  return (
    <View style={styles.root}>
      <View style={styles.heroCard}>
        <Ionicons name="videocam-outline" size={40} color={colors.brandNavy} />
        <Text style={styles.heroTitle}>Meeting Room</Text>
        <Text style={styles.heroSub}>
          Join your live session below. Make sure you have a stable internet connection.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Checking your sessions...</Text>
        </View>
      ) : liveSessions.length > 0 ? (
        <View style={styles.sessionsList}>
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          {liveSessions.map((session: any) => {
            const isTrainerRole = accountType === AccountType.TRAINER;
            const other = isTrainerRole ? session.trainee_info : session.trainer_info;
            const name = other?.fullname || other?.fullName || "Session";
            return (
              <View key={session._id} style={styles.sessionCard}>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionName}>{name}</Text>
                  <Text style={styles.sessionTime}>
                    {session.start_time} – {session.end_time}
                  </Text>
                </View>
                <Button
                  label="Join"
                  leftIcon="videocam-outline"
                  size="sm"
                  fullWidth={false}
                />
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="No active sessions"
          description="Your live sessions will appear here when they are scheduled to start."
        />
      )}

      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>Before You Join</Text>
        {[
          "Check your camera and microphone",
          "Use a stable Wi-Fi connection for best quality",
          "Find a quiet, well-lit space",
          "Have your training materials ready",
        ].map((tip) => (
          <View key={tip} style={styles.tipRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, padding: space.md, gap: space.md },

  heroCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTitle: { ...typography.titleMd, color: colors.brandNavy },
  heroSub: { ...typography.bodyMd, color: colors.textMuted, textAlign: "center" },

  loadingCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: { ...typography.bodyMd, color: colors.textMuted },

  sessionsList: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
  },
  sectionTitle: { ...typography.subtitle, color: colors.text },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  sessionInfo: { flex: 1 },
  sessionName: { ...typography.bodyMd, fontWeight: "700", color: colors.text },
  sessionTime: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  tipsCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipsTitle: { ...typography.bodyMd, fontWeight: "700", color: colors.text, marginBottom: 4 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipText: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },
});
