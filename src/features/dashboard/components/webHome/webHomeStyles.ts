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
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
        marginBottom: space.md,
        ...cardShadow,
      },
      homeMainContBody: { padding: 15 },
      homeMainTitle: {
        textAlign: "center",
        marginBottom: 16,
        fontSize: 18,
        fontWeight: "600",
        color: colors.text,
      },
      trainerBox1: {
        margin: 5,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 10,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: colors.surfaceElevated,
        alignSelf: "stretch",
        borderWidth: 1,
        borderColor: colors.border,
        ...trainerBoxShadow,
      },
      recentUsersGridTrainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
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
        paddingVertical: 4,
      },
      friendRequestTile: {
        borderWidth: 2,
        borderColor: colors.iconPrimary,
        borderRadius: 5,
        padding: 8,
        alignItems: "center",
        marginBottom: 8,
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
        marginBottom: 4,
      },
      homePromoSub: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: space.sm,
      },
    })
  );
}
