import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { useQuery } from "@tanstack/react-query";
import { fetchScheduledMeetings } from "../../home/api/homeApi";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";

const NAVY = "#000080";

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
  const isTrainer = accountType === AccountType.TRAINER;

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", "upcoming"],
    queryFn: () => fetchScheduledMeetings("upcoming"),
    staleTime: 30_000,
  });

  const liveSessions = sessions.filter(isSessionLiveNow);

  return (
    <View style={styles.root}>
      <View style={styles.heroCard}>
        <Ionicons name="videocam-outline" size={40} color={NAVY} />
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
                <Pressable
                  style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="videocam-outline" size={16} color="#fff" />
                  <Text style={styles.joinBtnText}>Join</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.noSessionCard}>
          <Ionicons name="calendar-outline" size={40} color="#d1d5db" />
          <Text style={styles.noSessionTitle}>No active sessions</Text>
          <Text style={styles.noSessionSub}>
            Your live sessions will appear here when they are scheduled to start.
          </Text>
        </View>
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
            <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb", padding: space.md, gap: space.md },

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  heroTitle: { fontSize: 20, fontWeight: "700", color: NAVY },
  heroSub: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },

  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  loadingText: { fontSize: 14, color: "#6b7280" },

  sessionsList: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: space.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f3f4f6",
  },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  sessionTime: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: NAVY,
    borderRadius: radii.sm,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  joinBtnText: { fontSize: 13, color: "#fff", fontWeight: "600" },

  noSessionCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.xl,
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  noSessionTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  noSessionSub: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },

  tipsCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tipsTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 4 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipText: { fontSize: 13, color: "#374151", flex: 1, lineHeight: 18 },
});
