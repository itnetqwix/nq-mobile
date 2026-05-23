import { StyleSheet } from "react-native";
import type { AppColors } from "../../../../theme/colors";
import { radii, space, typography } from "../../../../theme";

/** Shared spacing + surfaces for trainer home sections. */
export function createTrainerDashboardStyles(palette: AppColors) {
  return StyleSheet.create({
    stack: {
      gap: space.md,
      paddingTop: space.md,
      paddingBottom: space.sm,
    },
    card: {
      backgroundColor: palette.surfaceElevated,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: palette.border,
      overflow: "hidden",
    },
    cardPadding: {
      padding: space.md,
    },
    cardGap: {
      gap: space.sm,
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    rowStart: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
    },
    flex1: { flex: 1, minWidth: 0 },
    welcome: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
    role: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
    sectionLink: {
      ...typography.caption,
      color: palette.brandNavy,
      fontWeight: "700",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: palette.border,
      marginHorizontal: space.md,
    },
    scheduleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      paddingHorizontal: space.md,
      paddingVertical: space.md,
    },
    scheduleText: { ...typography.bodySm, color: palette.text, flex: 1 },
    earningsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: space.sm,
      paddingTop: space.xs,
    },
    horizontalStrip: {
      gap: space.sm,
      paddingVertical: space.xs,
    },
    traineeTile: {
      width: 92,
      alignItems: "center",
      padding: space.sm,
      borderRadius: radii.md,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: palette.border,
    },
    traineeName: {
      ...typography.caption,
      color: palette.text,
      fontWeight: "600",
      textAlign: "center",
      marginTop: space.sm,
      width: "100%",
    },
  });
}
