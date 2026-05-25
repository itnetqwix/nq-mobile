import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AccountType } from "../../../constants/accountType";
import { Button, EmptyState, Pill, Skeleton } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchTrainerSlots } from "../../home/api/homeApi";
import { UpcomingSessionsScreen } from "../../sessions/screens/UpcomingSessionsScreen";
import type { MainTabScreenProps } from "../../../navigation/types";

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

function titleDay(day: string, t: (key: string) => string): string {
  const n = normDay(day);
  if (!n) return t("schedule.dayFallback");
  const key = `schedule.days.${n}`;
  const translated = t(key);
  return translated !== key ? translated : n.charAt(0).toUpperCase() + n.slice(1);
}

type DaySection = {
  title: string;
  data: { start_time?: string; end_time?: string }[];
};

function TrainerSchedule() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { data: inventory = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.trainer.slots,
    queryFn: fetchTrainerSlots,
    staleTime: 60_000,
  });

  const sections: DaySection[] = useMemo(() => {
    const avail = Array.isArray(inventory) ? inventory : [];
    return WEEK_ORDER.map((day) => {
      const row = avail.find((d: any) => normDay(d?.day) === day);
      const slots = Array.isArray(row?.slots) ? row!.slots : [];
      return { title: titleDay(day, t), data: slots };
    }).filter((s) => s.data.length > 0);
  }, [inventory, t]);

  const openScheduleEditor = useCallback(() => {
    try {
      navigation.navigate("Home", {
        screen: "ShellSurface",
        params: { surfaceId: "trainerSchedule" },
      });
    } catch {
      /* fallback if nested nav doesn't resolve */
    }
  }, [navigation]);

  if (isLoading) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Skeleton height={22} width={160} />
          <Skeleton height={36} width={120} radius={radii.md} />
        </View>
        {[0, 1, 2, 3].map((row) => (
          <View key={row} style={styles.skeletonSection}>
            <Skeleton height={14} width={110} />
            <View style={{ height: 8 }} />
            <Skeleton height={62} radius={radii.lg} />
            <View style={{ height: 6 }} />
            <Skeleton height={62} radius={radii.lg} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t("schedule.mySchedule")}</Text>
        </View>
        <Button
          label={t("schedule.editSchedule")}
          leftIcon="create-outline"
          onPress={openScheduleEditor}
          size="sm"
          fullWidth={false}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.start_time}-${item.end_time}-${index}`}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandNavy} />
        }
        contentContainerStyle={
          sections.length === 0 ? styles.listEmptyGrow : styles.listContent
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionTitle}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.slotCard}>
            <Ionicons name="time-outline" size={20} color={colors.brandNavy} />
            <Text style={styles.slotTime}>
              {t("schedule.timeRange", {
                start: item.start_time ?? t("schedule.timePlaceholder"),
                end: item.end_time ?? t("schedule.timePlaceholder"),
              })}
            </Text>
            <Pill label={t("schedule.available")} tone="success" />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title={t("schedule.noWeeklySlots")}
            description={t("schedule.noWeeklySlotsDescription")}
            actionLabel={t("schedule.editSchedule")}
            onAction={openScheduleEditor}
          />
        }
      />
    </View>
  );
}

type TrainerSegment = "sessions" | "availability";

/** Same UI as the Schedule bottom tab — use from dashboard deep links for parity. */
export function TrainerScheduleTabs() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<TrainerSegment>("sessions");

  return (
    <View style={styles.root}>
      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segmentBtn, segment === "sessions" && styles.segmentBtnActive]}
          onPress={() => setSegment("sessions")}
        >
          <Text style={[styles.segmentText, segment === "sessions" && styles.segmentTextActive]}>
            {t("schedule.mySessions")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, segment === "availability" && styles.segmentBtnActive]}
          onPress={() => setSegment("availability")}
        >
          <Text style={[styles.segmentText, segment === "availability" && styles.segmentTextActive]}>
            {t("schedule.availability")}
          </Text>
        </Pressable>
      </View>
      {segment === "sessions" ? (
        <View style={styles.segmentBody}>
          <UpcomingSessionsScreen />
        </View>
      ) : (
        <TrainerSchedule />
      )}
    </View>
  );
}

export function ScheduleScreen(_props: MainTabScreenProps<"Schedule">) {
  const { accountType } = useAuth();
  if (accountType === AccountType.TRAINER) {
    return <TrainerScheduleTabs />;
  }
  return <UpcomingSessionsScreen />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.titleSm, color: colors.brandNavy, fontSize: 18 },

  listContent: { padding: space.md, paddingBottom: space.xl },
  listEmptyGrow: { flexGrow: 1, padding: space.md },
  skeletonSection: { paddingHorizontal: space.md, paddingTop: space.md },

  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: 8,
    marginTop: 4,
  },
  slotCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotTime: { flex: 1, ...typography.subtitle, color: colors.textSecondary },

  segmentRow: {
    flexDirection: "row",
    marginHorizontal: space.md,
    marginTop: space.sm,
    marginBottom: space.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.sm,
    alignItems: "center",
  },
  segmentBtnActive: { backgroundColor: colors.brandNavy },
  segmentText: { ...typography.label, color: colors.textMuted, fontWeight: "600" },
  segmentTextActive: { color: colors.brandTextOn },
  segmentBody: { flex: 1 },
});
