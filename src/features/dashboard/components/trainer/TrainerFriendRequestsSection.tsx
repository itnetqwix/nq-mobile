import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HomeUserAvatar } from "../home/HomeUserAvatar";
import { DashboardSection } from "../shared/DashboardSection";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";

type Props = {
  requests: Array<Record<string, unknown>>;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
};

export function TrainerFriendRequestsSection({ requests, onAccept, onReject }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  if (!requests.length) return null;

  return (
    <DashboardSection embedded title={t("dashboardHome.recentFriendRequests")}>
      <View style={styles.list}>
        {requests.map((req, index) => {
          const id = String(req._id ?? index);
          const sender = (req.senderId ?? req.sender) as Record<string, unknown> | undefined;
          const name = String(
            sender?.fullname ?? sender?.fullName ?? t("dashboardHome.userDefault")
          );
          return (
            <View key={id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <HomeUserAvatar uri={sender?.profile_picture as string | undefined} name={name} size={48} />
              <Text style={styles.name} numberOfLines={2}>
                {name}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.btn, { backgroundColor: c.success }]}
                  onPress={() => onAccept(id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("dashboardHome.acceptRequestA11y", { name })}
                >
                  <Text style={styles.btnText}>{t("dashboardHome.accept")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, { backgroundColor: c.danger }]}
                  onPress={() => onReject(id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("dashboardHome.rejectRequestA11y", { name })}
                >
                  <Text style={styles.btnText}>{t("dashboardHome.reject")}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </DashboardSection>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      list: {
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        overflow: "hidden",
      },
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
      },
      rowBorder: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
      },
      name: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "600",
        flex: 1,
        minWidth: 0,
      },
      actions: { flexDirection: "row", gap: space.xs, flexShrink: 0 },
      btn: {
        borderRadius: radii.sm,
        paddingHorizontal: space.sm,
        paddingVertical: 6,
        minWidth: 64,
        alignItems: "center",
      },
      btnText: { ...typography.caption, color: palette.brandTextOn, fontWeight: "700" },
    })
  );
}
