import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Avatar } from "../../../../components/ui";
import { getS3ImageUrl } from "../../../../lib/imageUtils";
import { radii, space, typography, useThemedStyles } from "../../../../theme";
import { HomeUserAvatar } from "../home/HomeUserAvatar";

export const PERSON_TILE_WIDTH = 108;
export const PERSON_TILE_AVATAR = 44;

type Props = {
  name: string;
  avatar?: string;
  onPress: () => void;
  badge?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  useHomeAvatar?: boolean;
  onlineStatus?: "online" | "offline";
};

/** Compact white person tile — shared by favorite coaches & friends strips. */
export function DashboardPersonTile({
  name,
  avatar,
  onPress,
  badge,
  style,
  useHomeAvatar = false,
  onlineStatus,
}: Props) {
  const styles = useStyles();
  const avatarUri = avatar ? getS3ImageUrl(avatar) : undefined;
  const showOnlineRing = onlineStatus === "online";

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, style, pressed && styles.tilePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View style={styles.content}>
        <View style={[styles.avatarWrap, showOnlineRing && styles.avatarWrapOnline]}>
          {useHomeAvatar ? (
            <HomeUserAvatar
              uri={avatar}
              name={name}
              size={PERSON_TILE_AVATAR}
              onlineStatus={onlineStatus}
            />
          ) : (
            <Avatar uri={avatarUri} name={name} size="sm" />
          )}
          {badge}
          {showOnlineRing && !useHomeAvatar ? <View style={styles.onlineDot} /> : null}
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      tile: {
        width: PERSON_TILE_WIDTH,
        alignItems: "center",
        paddingHorizontal: space.sm,
        paddingTop: space.md,
        paddingBottom: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.border,
        shadowColor: "#111827",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
      content: {
        alignItems: "center",
        gap: space.sm,
        width: "100%",
      },
      tilePressed: {
        opacity: 0.88,
        transform: [{ scale: 0.97 }],
      },
      avatarWrap: {
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
      },
      avatarWrapOnline: {
        borderWidth: 2,
        borderColor: "#4CAF50",
        borderRadius: PERSON_TILE_AVATAR / 2 + 4,
        padding: 2,
      },
      onlineDot: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#4CAF50",
        borderWidth: 1.5,
        borderColor: palette.surfaceElevated,
      },
      name: {
        ...typography.caption,
        color: palette.text,
        fontWeight: "700",
        textAlign: "center",
        minHeight: 28,
        lineHeight: 15,
        paddingHorizontal: 2,
      },
    })
  );
}
