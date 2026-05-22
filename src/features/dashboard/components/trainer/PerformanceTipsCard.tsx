import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TrainerScheduleDay } from "../../../home/api/homeApi";
import { countSlotsNextWeek, hasThursdaySlot } from "../../lib/trainerSlotUtils";
import { DashboardSection } from "../shared/DashboardSection";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  pendingCount: number;
  showAsOnline: boolean;
  scheduleSlots: TrainerScheduleDay[];
};

export function PerformanceTipsCard({
  pendingCount,
  showAsOnline,
  scheduleSlots,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const tips = useMemo(() => {
    const out: string[] = [];
    if (pendingCount > 0) {
      out.push(t("trainerDashboard.tipPendingRequests", { count: pendingCount }));
    }
    if (!hasThursdaySlot(scheduleSlots)) {
      out.push(t("trainerDashboard.tipAddSlots"));
    } else if (countSlotsNextWeek(scheduleSlots) < 3) {
      out.push(t("trainerDashboard.tipAddSlots"));
    }
    if (!showAsOnline) {
      out.push(t("trainerDashboard.tipGoLive"));
    }
    return out.slice(0, 3);
  }, [pendingCount, showAsOnline, scheduleSlots, t]);

  if (!tips.length) return null;

  return (
    <DashboardSection title={t("trainerDashboard.performanceTips")}>
      <View style={styles.card}>
        {tips.map((tip, i) => (
          <View key={i} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Ionicons name="bulb-outline" size={18} color={c.brandNavy} />
            <Text style={styles.text}>{tip}</Text>
          </View>
        ))}
      </View>
    </DashboardSection>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        overflow: "hidden",
      },
      row: { flexDirection: "row", gap: space.sm, padding: space.md, alignItems: "flex-start" },
      rowBorder: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
      },
      text: { ...typography.bodySm, color: palette.text, flex: 1 },
    })
  );
}
