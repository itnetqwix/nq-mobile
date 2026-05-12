import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WEB_APP_ORIGIN } from "../../../config/env";
import { WebRoutes } from "../../../constants/webRoutes";
import { AccountType } from "../../../constants/accountType";
import { radii, space } from "../../../theme/tokens";
import { useAuth } from "../../auth/context/AuthContext";
import { fetchScheduledMeetings, fetchTrainerSlots } from "../../home/api/homeApi";
import { UpcomingSessionsScreen } from "../../sessions/screens/UpcomingSessionsScreen";
import type { MainTabScreenProps } from "../../../navigation/types";

const NAVY = "#000080";

const WEEK_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function normDay(d: string): string {
  return String(d || "")
    .trim()
    .toLowerCase();
}

function titleDay(day: string): string {
  const n = normDay(day);
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "Day";
}

type DaySection = {
  title: string;
  data: { start_time?: string; end_time?: string }[];
};

function TrainerSchedule() {
  const { data: inventory = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["trainerSlots"],
    queryFn: fetchTrainerSlots,
    staleTime: 60_000,
  });

  const sections: DaySection[] = useMemo(() => {
    const avail = Array.isArray(inventory) ? inventory : [];
    return WEEK_ORDER.map((day) => {
      const row = avail.find((d: any) => normDay(d?.day) === day);
      const slots = Array.isArray(row?.slots) ? row!.slots : [];
      return { title: titleDay(day), data: slots };
    }).filter((s) => s.data.length > 0);
  }, [inventory]);

  const openWebSchedule = useCallback(async () => {
    const url = `${WEB_APP_ORIGIN.replace(/\/$/, "")}${WebRoutes.dashboardSchedule}`;
    if (await Linking.canOpenURL(url)) void Linking.openURL(url);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My schedule</Text>
          <Text style={styles.headerSub}>
            Weekly hours from `GET /trainer/get-slots` (`available_slots`), same source as the web
            schedule page.
          </Text>
        </View>
        <Pressable style={styles.manageBtn} onPress={openWebSchedule}>
          <Ionicons name="open-outline" size={18} color="#fff" />
          <Text style={styles.manageBtnText}>Edit on web</Text>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.start_time}-${item.end_time}-${index}`}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
        }
        contentContainerStyle={
          sections.length === 0 ? styles.listEmptyGrow : styles.listContent
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionTitle}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.slotCard}>
            <Ionicons name="time-outline" size={20} color={NAVY} />
            <Text style={styles.slotTime}>
              {item.start_time ?? "—"} – {item.end_time ?? "—"}
            </Text>
            <View style={styles.availPill}>
              <Text style={styles.availPillText}>Available</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No weekly slots yet</Text>
            <Text style={styles.emptyBody}>
              Set your availability on the website schedule screen, then pull to refresh here.
            </Text>
            <Pressable style={styles.cta} onPress={openWebSchedule}>
              <Text style={styles.ctaText}>Open schedule on web</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

export function ScheduleScreen(_props: MainTabScreenProps<"Schedule">) {
  const { accountType } = useAuth();
  if (accountType === AccountType.TRAINER) {
    return <TrainerSchedule />;
  }
  return <UpcomingSessionsScreen />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: "#fff",
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: NAVY },
  headerSub: { fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 16 },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: NAVY,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  manageBtnText: { fontSize: 12, color: "#fff", fontWeight: "600" },

  listContent: { padding: space.md, paddingBottom: space.xl },
  listEmptyGrow: { flexGrow: 1, padding: space.md },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    marginTop: 4,
  },
  slotCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  slotTime: { flex: 1, fontSize: 15, fontWeight: "600", color: "#374151" },
  availPill: {
    backgroundColor: "#dcfce7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  availPillText: { fontSize: 11, fontWeight: "700", color: "#15803d" },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  cta: {
    marginTop: space.md,
    backgroundColor: NAVY,
    borderRadius: radii.md,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
