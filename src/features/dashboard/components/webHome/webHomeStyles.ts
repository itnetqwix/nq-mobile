/**
 * Visual tokens aligned with web locker home:
 * - `NavHomePage` + `home.scss` (`.Trainer-box-1`, `.Home-main-Cont` inline styles)
 * - `public/assets/scss/custom/custom.scss` (`.trainer-profile-card`)
 */
import { Platform, StyleSheet } from "react-native";
import { colors, radii, space } from "../../../../theme";

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

export const webHomeStyles = StyleSheet.create({
  /** `card trainer-profile-card Home-main-Cont` — white panel on grey shell */
  homeMainCont: {
    width: "100%",
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 0,
    overflow: "hidden",
    marginBottom: space.md,
    ...cardShadow,
  },
  homeMainContBody: {
    padding: 15,
  },
  homeMainTitle: {
    textAlign: "center",
    marginBottom: 16,
    fontSize: 18,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  /** `.Trainer-box-1.card-body` — coach / expert tile */
  trainerBox1: {
    margin: 5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.background,
    alignSelf: "stretch",
    ...trainerBoxShadow,
  },
  /** `recent-users-grid.trainer-students-grid` */
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
  /** `recent-users-grid.single-row-experts` — horizontal strip */
  recentUsersRowTrainee: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: space.md,
    paddingVertical: 4,
  },
  /** Friend request mini card — matches NavHomePage inline (navy border) */
  friendRequestTile: {
    borderWidth: 2,
    borderColor: colors.brandNavy,
    borderRadius: 5,
    padding: 8,
    alignItems: "center",
    marginBottom: 8,
    minWidth: 120,
  },
  /** `upload-clip-container` / `invite-card-container` — paired promo tiles */
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
    backgroundColor: colors.surface,
  },
  homePromoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brandNavy,
    marginBottom: 4,
  },
  homePromoSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: space.sm,
  },
});
