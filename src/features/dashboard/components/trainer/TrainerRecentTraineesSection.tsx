import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { HomeUserAvatar } from "../home/HomeUserAvatar";
import { trainerListItemKey } from "../../../../lib/lists/trainerListUtils";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";

type Props = {
  trainees: Record<string, unknown>[];
};

export function TrainerRecentTraineesSection({ trainees }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  if (!trainees.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="people-outline" size={16} color={c.brandNavy} />
        <Text style={styles.title}>
          {t("dashboardHome.recentTrainees", { defaultValue: "Recent Students" })}
        </Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {trainees.map((user, index) => {
          const name = String(
            user.fullname ?? user.fullName ?? user.name ??
            t("dashboardHome.userDefault", { defaultValue: "Student" })
          );
          const sport = String(user.sport ?? user.category ?? "");
          const sessionCount = typeof user.session_count === "number" ? user.session_count : null;
          return (
            <View
              key={trainerListItemKey(user, index, "recent-trainee-")}
              style={styles.tile}
            >
              <HomeUserAvatar
                uri={user.profile_picture as string | undefined}
                name={name}
                size={60}
              />
              <Text style={styles.name} numberOfLines={2}>{name}</Text>
              {sport ? (
                <View style={styles.sportTag}>
                  <Ionicons name="trophy-outline" size={10} color={c.brandNavy} />
                  <Text style={styles.sportText} numberOfLines={1}>{sport}</Text>
                </View>
              ) : sessionCount != null ? (
                <View style={styles.sportTag}>
                  <Ionicons name="checkmark-circle-outline" size={10} color={c.success} />
                  <Text style={[styles.sportText, { color: c.success }]}>
                    {t("trainerDashboard.sessionCount", {
                      defaultValue: "{{n}} sessions",
                      n: sessionCount,
                    })}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: {},
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        marginBottom: space.sm,
      },
      title: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
      },
      strip: {
        gap: space.sm,
        paddingVertical: space.xs,
      },
      tile: {
        width: 104,
        alignItems: "center",
        gap: 5,
        padding: space.sm,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
      },
      name: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
        textAlign: "center",
        minHeight: 32,
      },
      sportTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: palette.brandAccentSubtle,
      },
      sportText: {
        fontSize: 10,
        fontWeight: "700",
        color: palette.brandNavy,
      },
    })
  );
}
