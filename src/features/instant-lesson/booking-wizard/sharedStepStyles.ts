import { StyleSheet } from "react-native";
import { colors, radii, space } from "../../../theme/tokens";

/** Layout + typography shared across wizard step bodies. */
export const sharedStepStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.sm,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  lead: { fontSize: 15, color: colors.text, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  mutedSmall: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
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
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    marginTop: space.sm,
    backgroundColor: "#f3f4f6",
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600", color: colors.text },
  btnDisabled: { opacity: 0.65 },
  rowGap: { gap: space.sm, marginTop: space.sm },
});
