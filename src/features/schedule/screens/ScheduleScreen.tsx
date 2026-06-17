import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AccountType } from "../../../constants/accountType";
import { Button, EmptyState, MorphRefreshHeader, Pill, TrainerScheduleSkeleton, SegmentedControl } from "../../../components/ui";
import { useCombinedScroll } from "../../../lib/refresh/useCombinedScroll";
import { useMorphRefreshBundle } from "../../../lib/refresh/useMorphRefreshBundle";
import { TabScreenShell } from "../../../lib/layout";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { queryKeys } from "../../../lib/queryKeys";
import { fetchTrainerSlots } from "../../home/api/homeApi";
import { UpcomingSessionsScreen } from "../../sessions/screens/UpcomingSessionsScreen";
import type { MainTabScreenProps } from "../../../navigation/types";
import { floatingTabBarBottomInset } from "../../../navigation/FloatingTabBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CoachMark } from "../../onboarding";
import { useHomeScrollHandler } from "../../home/hooks/useHomeScrollHandler";

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
  const homeScroll = useHomeScrollHandler();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const listPadBottom = useMemo(
    () => floatingTabBarBottomInset(insets.bottom) + space.md,
    [insets.bottom]
  );
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

  const morph = useMorphRefreshBundle(refetch, isRefetching);
  const onScheduleScroll = useCombinedScroll(morph.onMorphScroll, homeScroll.onScroll);

  if (isLoading) {
    return <TrainerScheduleSkeleton />;
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t("schedule.mySchedule")}</Text>
        </View>
        <CoachMark
          id="schedule.editAvailability.v1"
          title={t("coachMarks.scheduleEdit.title", {
            defaultValue: "Publish your availability",
          })}
          description={t("coachMarks.scheduleEdit.description", {
            defaultValue:
              "Add weekly slots so trainees can book you. Empty calendars don't show up in browse.",
          })}
          icon="create"
          placement="bottom"
        >
          <Button
            label={t("schedule.editSchedule")}
            leftIcon="create-outline"
            onPress={openScheduleEditor}
            size="sm"
            fullWidth={false}
          />
        </CoachMark>
      </View>

      <MorphRefreshHeader {...morph.headerProps} />
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.start_time}-${item.end_time}-${index}`}
        onScroll={onScheduleScroll}
        scrollEventThrottle={morph.scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={morph.refreshing}
            onRefresh={morph.onRefreshControl}
            tintColor={colors.brandNavy}
          />
        }
        contentContainerStyle={
          sections.length === 0
            ? styles.listEmptyGrow
            : [styles.listContent, { paddingBottom: listPadBottom }]
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
    <View style={styles.flex}>
      <SegmentedControl
        options={[
          { key: "sessions", label: t("schedule.mySessions") },
          { key: "availability", label: t("schedule.availability") },
        ]}
        value={segment}
        onChange={setSegment}
      />
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
  return (
    <TabScreenShell clearFloatingTabBar={false}>
      {accountType === AccountType.TRAINER ? (
        <TrainerScheduleTabs />
      ) : (
        <UpcomingSessionsScreen />
      )}
    </TabScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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

  listContent: { padding: space.md },
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

  segmentBody: { flex: 1 },
});
