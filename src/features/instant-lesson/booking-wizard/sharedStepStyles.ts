import { StyleSheet } from "react-native";
import { radii, space, typography, useStaticStyles } from "../../../theme";

export function useSharedStepStyles() {
  return useStaticStyles((colors) =>
    StyleSheet.create({
      card: {
        backgroundColor: colors.surfaceElevated,
        borderRadius: radii.lg,
        padding: space.lg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: space.sm,
      },
      sectionTitle: { ...typography.titleSm, color: colors.text },
      lead: { ...typography.bodyLg, color: colors.text },
      muted: { ...typography.bodyMd, color: colors.textMuted },
      mutedSmall: { ...typography.caption, color: colors.textMuted },
      primaryBtn: {
        marginTop: space.md,
        backgroundColor: colors.brandNavy,
        borderRadius: radii.md,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      },
      primaryBtnText: { ...typography.button, color: colors.brandTextOn },
      secondaryBtn: {
        marginTop: space.sm,
        backgroundColor: colors.surfaceMuted,
        borderRadius: radii.md,
        paddingVertical: 12,
        alignItems: "center",
      },
      secondaryBtnText: { ...typography.button, color: colors.text },
      btnDisabled: { opacity: 0.65 },
      rowGap: { gap: space.sm, marginTop: space.sm },
    })
  );
}
