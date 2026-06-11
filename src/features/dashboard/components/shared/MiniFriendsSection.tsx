import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../../../../components/ui";
import { queryKeys } from "../../../../lib/queryKeys";
import { getS3ImageUrl } from "../../../../lib/imageUtils";
import { fetchFriends } from "../../../home/api/homeApi";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

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
              <Pressable
                key={f.id}
                style={({ pressed }) => [styles.friendTile, pressed && { opacity: 0.8 }]}
                onPress={onPressAll}
                accessibilityRole="button"
              >
                <Avatar
                  uri={f.avatar ? getS3ImageUrl(f.avatar) : undefined}
                  name={f.name}
                  size={46}
                />
                <Text style={styles.friendName} numberOfLines={1}>{f.name}</Text>
              </Pressable>
            ))}

        {/* "More" button if there are friends */}
        {!isLoading && friends.length >= MAX_DISPLAY && (
          <Pressable
            style={[styles.friendTile, { opacity: 0.9 }]}
            onPress={onPressAll}
            accessibilityRole="button"
          >
            <View style={[styles.moreCircle, { backgroundColor: c.brandSubtle, borderColor: c.border }]}>
              <Ionicons name="ellipsis-horizontal" size={18} color={c.brandNavy} />
            </View>
            <Text style={styles.friendName}>
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
      wrap: {},
      header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: space.sm,
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
        gap: space.sm,
        paddingVertical: space.xs,
        paddingRight: space.sm,
      },
      friendTile: {
        alignItems: "center",
        gap: 5,
        width: 58,
      },
      avatarPh: {
        width: 46,
        height: 46,
        borderRadius: 23,
      },
      namePh: {
        width: 44,
        height: 8,
        borderRadius: 4,
      },
      friendName: {
        fontSize: 10,
        fontWeight: "600",
        color: palette.textMuted,
        textAlign: "center",
        width: "100%",
      },
      moreCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
      },
    })
  );
}
