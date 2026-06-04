import { Platform, StyleSheet } from "react-native";
import { radii, space, useStaticStyles } from "../../../../theme";

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
  default: {},
});

const trainerBoxShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
  },
  android: { elevation: 4 },
  default: {},
});

export function useWebHomeStyles() {
  return useStaticStyles((colors) =>
    StyleSheet.create({
      homeMainCont: {
        width: "100%",
        backgroundColor: colors.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        marginBottom: space.md,
        ...cardShadow,
      },
      homeMainContBody: { padding: space.md },
      homeMainTitle: {
        textAlign: "center",
        marginBottom: space.md,
        fontSize: 18,
        fontWeight: "600",
        color: colors.text,
      },
      trainerBox1: {
        margin: space.xs,
        borderRadius: radii.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.sm,
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
        backgroundColor: colors.surfaceElevated,
        alignSelf: "stretch",
        borderWidth: 1,
        borderColor: colors.border,
        ...trainerBoxShadow,
      },
      recentUsersGridTrainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.sm,
        justifyContent: "space-between",
      },
      recentUsersGridItemTrainer: {
        width: "48%",
        minWidth: "47%",
        alignItems: "center",
      },
      recentUsersRowTrainee: {
        flexDirection: "row",
        flexWrap: "nowrap",
        gap: space.md,
        paddingVertical: space.xs,
      },
      friendRequestTile: {
        borderWidth: 2,
        borderColor: colors.iconPrimary,
        borderRadius: radii.sm,
        padding: space.sm,
        alignItems: "center",
        marginBottom: space.sm,
        minWidth: 120,
        backgroundColor: colors.surfaceElevated,
      },
      homePromoRow: {
        flexDirection: "row",
        gap: space.sm,
        flexWrap: "wrap",
      },
      homePromoHalf: {
        flex: 1,
        minWidth: 140,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: space.md,
        backgroundColor: colors.surfaceElevated,
      },
      homePromoTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: colors.iconPrimary,
        marginBottom: space.xs,
      },
      homePromoSub: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: space.sm,
      },
    })
  );
}
