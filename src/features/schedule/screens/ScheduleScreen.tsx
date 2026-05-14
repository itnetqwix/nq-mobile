import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AccountType } from "../../../constants/accountType";
import { Button, EmptyState, Pill } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
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

function titleDay(day: string): string {
  const n = normDay(day);
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "Day";
}

type DaySection = {
  title: string;
  data: { start_time?: string; end_time?: string }[];
};

function TrainerSchedule() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
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

  const openScheduleEditor = useCallback(() => {
    try {
      navigation.navigate("Menu", {
        screen: "ShellSurface",
        params: { surfaceId: "trainerSchedule" },
      });
    } catch {
      /* fallback if nested nav doesn't resolve */
    }
  }, [navigation]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brandNavy} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Schedule</Text>
        </View>
        <Button
          label="Edit schedule"
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
              {item.start_time ?? "—"} – {item.end_time ?? "—"}
            </Text>
            <Pill label="Available" tone="success" />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No weekly slots yet"
            description="Tap 'Edit schedule' to set your weekly availability."
            actionLabel="Edit schedule"
            onAction={openScheduleEditor}
          />
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
});
