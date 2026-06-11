import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { queryKeys } from "../../../../lib/queryKeys";
import { fetchFriends } from "../../../home/api/homeApi";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { DashboardPersonTile, PERSON_TILE_AVATAR } from "./DashboardPersonTile";

const MAX_DISPLAY = 5;

type Props = {
  onPressAll: () => void;
};

export function MiniFriendsSection({ onPressAll }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();

  const { data: rawFriends = [], isLoading } = useQuery({
    queryKey: queryKeys.friends.list,
    queryFn: fetchFriends,
    staleTime: 120_000,
  });

  const friends = (rawFriends as any[])
    .map((f) => ({
      id: String(f._id ?? f.id ?? ""),
      name: String(f.fullname ?? f.full_name ?? f.name ?? t("locker.friendDefault")),
      avatar: f.profile_picture ?? f.avatar,
    }))
    .filter((f) => f.id)
    .slice(0, MAX_DISPLAY);

  if (!isLoading && friends.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.header} onPress={onPressAll} accessibilityRole="button">
        <View style={styles.headerLeft}>
          <Ionicons name="people-outline" size={15} color={c.brandNavy} />
          <Text style={styles.title}>
            {t("dashboardHome.friends", { defaultValue: "Friends" })}
          </Text>
        </View>
        <View style={styles.seeAll}>
          <Text style={styles.seeAllText}>
            {t("common.seeAll", { defaultValue: "See all" })}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={c.brandNavy} />
        </View>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <View key={i} style={styles.friendTile}>
                <View style={[styles.avatarPh, { backgroundColor: c.surfaceMuted }]} />
                <View style={[styles.namePh, { backgroundColor: c.surfaceMuted }]} />
              </View>
            ))
          : friends.map((f) => (
              <DashboardPersonTile
                key={f.id}
                name={f.name}
                avatar={f.avatar}
                onPress={onPressAll}
                useHomeAvatar
              />
            ))}

        {!isLoading && friends.length >= MAX_DISPLAY && (
          <Pressable
            style={[styles.moreTile, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}
            onPress={onPressAll}
            accessibilityRole="button"
          >
            <View style={[styles.moreCircle, { backgroundColor: c.brandSubtle, borderColor: c.border }]}>
              <Ionicons name="ellipsis-horizontal" size={16} color={c.brandNavy} />
            </View>
            <Text style={styles.moreName}>
              {t("common.more", { defaultValue: "More" })}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { marginBottom: space.sm },
      header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: space.md,
      },
      headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
      },
      title: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
      },
      seeAll: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
      },
      seeAllText: {
        ...typography.caption,
        color: palette.brandNavy,
        fontWeight: "600",
      },
      strip: {
        gap: space.md,
        paddingVertical: space.sm,
        paddingRight: space.sm,
      },
      friendTile: {
        width: 108,
        alignItems: "center",
        gap: 5,
      },
      avatarPh: {
        width: PERSON_TILE_AVATAR,
        height: PERSON_TILE_AVATAR,
        borderRadius: PERSON_TILE_AVATAR / 2,
      },
      namePh: {
        width: 56,
        height: 8,
        borderRadius: 4,
      },
      moreTile: {
        width: 108,
        alignItems: "center",
        paddingTop: space.sm,
        paddingBottom: space.md,
        borderRadius: 12,
        borderWidth: 1,
      },
      moreCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
      },
      moreName: {
        fontSize: 10,
        fontWeight: "600",
        color: palette.textMuted,
        textAlign: "center",
        marginTop: space.sm,
      },
    })
  );
}
