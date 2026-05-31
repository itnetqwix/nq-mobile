import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { radii, space, useStaticStyles, useThemeColors } from "../../../theme";
import { useSharedStepStyles } from "../../instant-lesson/booking-wizard/sharedStepStyles";
import { nextDays } from "../timeSlotUtils";
import type { SmartScheduleSuggestion } from "../../ai/smartScheduleApi";

type Props = {
  traineeTz: string;
  trainerTimezone: string | null;
  selectedDate: string;
  onSelectDate: (isoDate: string) => void;
  startCandidates: import("luxon").DateTime[];
  selectedStartIso: string | null;
  onSelectStart: (iso: string) => void;
  loading: boolean;
  errorMessage?: string;
  smartSuggestions?: SmartScheduleSuggestion[];
  smartSuggestionsLoading?: boolean;
  onNext: () => void;
};

export function ScheduleStepDateTime({
  traineeTz,
  trainerTimezone,
  selectedDate,
  onSelectDate,
  startCandidates,
  selectedStartIso,
  onSelectStart,
  loading,
  errorMessage,
  smartSuggestions = [],
  smartSuggestionsLoading = false,
  onNext,
}: Props) {
  const c = useThemeColors();
  const shared = useSharedStepStyles();
  const styles = useStyles();
  const days = nextDays(14, traineeTz);

  return (
    <View style={shared.card}>
      <Text style={shared.sectionTitle}>Pick a date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
        {days.map((d) => {
          const iso = d.toISODate()!;
          const on = selectedDate.startsWith(iso);
          return (
            <Pressable
              key={iso}
              style={[styles.dateChip, on && styles.dateChipOn]}
              onPress={() => onSelectDate(iso)}
            >
              <Text style={[styles.dateChipDay, on && styles.dateChipTextOn]}>{d.toFormat("ccc")}</Text>
              <Text style={[styles.dateChipNum, on && styles.dateChipTextOn]}>{d.toFormat("d")}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[shared.sectionTitle, { marginTop: space.md }]}>Available start times</Text>
      <Text style={shared.mutedSmall}>Times shown in your timezone ({traineeTz})</Text>
      {trainerTimezone ? (
        <Text style={shared.mutedSmall}>Trainer timezone: {trainerTimezone}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={c.brandNavy} style={{ marginVertical: space.md }} />
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : startCandidates.length === 0 ? (
        <Text style={shared.muted}>No available times on this day. Try another date.</Text>
      ) : (
        <View style={styles.timeGrid}>
          {startCandidates.map((dt) => {
            const iso = dt.toISO()!;
            const on = selectedStartIso === iso;
            return (
              <Pressable
                key={iso}
                style={[styles.timeChip, on && styles.timeChipOn]}
                onPress={() => onSelectStart(iso)}
              >
                <Text style={[styles.timeChipText, on && styles.timeChipTextOn]}>
                  {dt.toFormat("h:mm a")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        style={[shared.primaryBtn, !selectedStartIso && shared.btnDisabled]}
        disabled={!selectedStartIso}
        onPress={onNext}
      >
        <Text style={shared.primaryBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color={c.brandTextOn} />
      </Pressable>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      dateRow: { marginVertical: space.sm },
      dateChip: {
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginRight: 8,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
        minWidth: 56,
      },
      dateChipOn: { backgroundColor: palette.brandNavy, borderColor: palette.brandNavy },
      dateChipDay: { fontSize: 12, color: palette.textMuted, fontWeight: "600" },
      dateChipNum: { fontSize: 18, fontWeight: "700", color: palette.text },
      dateChipTextOn: { color: palette.brandTextOn },
      timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.sm },
      timeChip: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
      },
      timeChipOn: { backgroundColor: palette.brandNavy, borderColor: palette.brandNavy },
      timeChipText: { fontSize: 15, fontWeight: "600", color: palette.text },
      timeChipTextOn: { color: palette.brandTextOn },
      errorText: { color: palette.danger, marginVertical: space.sm },
      smartBox: {
        marginBottom: space.md,
        padding: space.sm,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.xs,
      },
      smartRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 6 },
      smartTextWrap: { flex: 1, gap: 2 },
      smartWhen: { fontSize: 14, fontWeight: "600", color: palette.text },
    })
  );
}
