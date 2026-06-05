import { Platform, StyleSheet } from "react-native";
import { radii, space, themedShadow, typography, useTheme, useThemedStyles } from "../../../theme";

/** Shared overlay / sheet chrome for chat action sheets and pickers. */
export function useChatOverlayStyles() {
  const { scheme } = useTheme();
  const isDark = scheme === "dark";

  return useThemedStyles((c) =>
    StyleSheet.create({
      backdrop: {
        flex: 1,
        backgroundColor: c.scrim,
        justifyContent: "flex-end",
      },
      sheetWrap: {
        paddingHorizontal: space.md,
        paddingBottom: space.xl,
        gap: space.sm,
      },
      bottomSheet: {
        backgroundColor: c.surfaceElevated,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingHorizontal: space.md,
        paddingBottom: space.lg,
        maxHeight: "82%",
        ...(Platform.OS === "ios" ? themedShadow("lg", isDark) : { elevation: 8 }),
      },
      handleRow: { alignItems: "center", paddingTop: space.sm, paddingBottom: 4 },
      handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: c.neutral300,
      },
      headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingBottom: space.sm,
      },
      headerRowBetween: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: space.sm,
      },
      sheetTitle: {
        flex: 1,
        ...typography.titleSm,
        color: c.text,
      },
      sheetSubtitle: {
        ...typography.bodySm,
        color: c.textMuted,
        marginTop: 4,
        marginBottom: space.sm,
      },
      rowPressed: {
        backgroundColor: c.surfaceMuted,
      },
      reactionsRow: {
        flexDirection: "row",
        alignSelf: "center",
        backgroundColor: c.surfaceElevated,
        paddingVertical: space.sm,
        paddingHorizontal: space.sm,
        borderRadius: radii.pill,
        gap: 4,
        ...(Platform.OS === "ios" ? themedShadow("lg", isDark) : { elevation: 6 }),
      },
      reactionPill: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
      },
      reactionPillActive: {
        backgroundColor: c.brandAccentSubtle,
      },
      reactionEmoji: {
        fontSize: 24,
      },
      actionsCard: {
        backgroundColor: c.surfaceElevated,
        borderRadius: radii.lg,
        overflow: "hidden",
        ...(Platform.OS === "ios" ? themedShadow("md", isDark) : { elevation: 4 }),
      },
      actionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space.md,
        paddingVertical: 14,
      },
      actionRowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
      },
      actionRowPressed: {
        backgroundColor: c.surfaceMuted,
      },
      actionLabel: {
        ...typography.bodyMd,
        fontWeight: "500",
        color: c.text,
      },
      actionLabelDestructive: {
        color: c.danger,
      },
      modalHeader: {
        ...typography.titleSm,
        color: c.text,
        paddingHorizontal: space.md,
        paddingBottom: space.sm,
      },
      searchField: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginHorizontal: space.md,
        marginBottom: space.sm,
        backgroundColor: c.surfaceMuted,
        borderRadius: radii.md,
        paddingHorizontal: space.sm,
        paddingVertical: 10,
      },
      searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: c.surfaceMuted,
        borderRadius: radii.md,
        paddingHorizontal: space.sm,
        paddingVertical: 10,
        marginBottom: space.sm,
      },
      searchInput: {
        flex: 1,
        ...typography.bodyMd,
        color: c.text,
        padding: 0,
      },
      listRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
      },
      listRowPressed: {
        backgroundColor: c.surfaceMuted,
      },
      listTitle: {
        ...typography.bodyMd,
        fontWeight: "600",
        color: c.text,
      },
      listSub: {
        ...typography.caption,
        color: c.textMuted,
        marginTop: 2,
      },
      searchHighlight: {
        backgroundColor: c.chatSearchHighlight,
        fontWeight: "700",
        color: c.text,
      },
      optionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
      },
      optionRowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
      },
      optionLabel: {
        ...typography.bodyMd,
        color: c.text,
      },
      optionLabelActive: {
        color: c.brand,
        fontWeight: "700",
      },
      avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: c.surfaceMuted,
      },
      avatarSm: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.surfaceMuted,
      },
      avatarFallback: {
        alignItems: "center",
        justifyContent: "center",
      },
      avatarLetter: {
        color: c.textSecondary,
        fontWeight: "700",
        fontSize: 16,
      },
      checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: c.border,
        alignItems: "center",
        justifyContent: "center",
      },
      checkboxChecked: {
        backgroundColor: c.brand,
        borderColor: c.brand,
      },
      separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.border,
      },
      emptyText: {
        textAlign: "center",
        ...typography.bodySm,
        color: c.textMuted,
        marginTop: space.md,
        paddingVertical: space.lg,
      },
      sendBtn: {
        position: "absolute",
        left: space.md,
        right: space.md,
        bottom: 14,
        backgroundColor: c.brand,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: space.sm,
      },
      sendBtnDisabled: {
        backgroundColor: c.neutral400,
      },
      sendLabel: {
        ...typography.button,
        color: c.brandTextOn,
      },
      cancelChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: space.sm,
        paddingVertical: 6,
        backgroundColor: c.dangerSubtle,
        borderRadius: radii.sm,
      },
      cancelChipLabel: {
        ...typography.caption,
        color: c.danger,
        fontWeight: "700",
      },
      searchResultsWrap: {
        paddingHorizontal: space.sm,
        paddingTop: space.sm,
      },
      searchResultsHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 4,
        paddingVertical: space.sm,
      },
      searchResultsHeaderLabel: {
        ...typography.caption,
        color: c.textMuted,
        fontWeight: "600",
      },
      scheduledRow: {
        flexDirection: "row",
        gap: 10,
        alignItems: "flex-start",
        paddingVertical: 12,
      },
      scheduledRecipient: {
        ...typography.bodySm,
        fontWeight: "700",
        color: c.text,
      },
      scheduledPreview: {
        ...typography.bodySm,
        color: c.textSecondary,
        marginTop: 2,
      },
      scheduledWhen: {
        ...typography.caption,
        color: c.textMuted,
        marginTop: 4,
      },
    })
  );
}
