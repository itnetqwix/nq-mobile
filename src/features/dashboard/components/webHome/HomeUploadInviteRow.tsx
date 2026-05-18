import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "../../../../theme";
import { useWebHomeStyles } from "./webHomeStyles";

type Props = {
  onClips: () => void;
  onInvite: () => void;
};

/**
 * Web locker home pairs clip access (`upload-clip-container`) and
 * `InviteFriendsCard` (`invite-card-container`) in the right column (`NavHomePage`).
 */
export function HomeUploadInviteRow({ onClips, onInvite }: Props) {
  const c = useThemeColors();
  const webHomeStyles = useWebHomeStyles();
  return (
    <View style={webHomeStyles.homePromoRow}>
      <Pressable
        style={({ pressed }) => [
          webHomeStyles.homePromoHalf,
          pressed && { opacity: 0.9 },
        ]}
        onPress={onClips}
        testID="upload-clip-container"
      >
        <Ionicons name="film-outline" size={26} color={c.iconPrimary} />
        <Text style={webHomeStyles.homePromoTitle}>Clips</Text>
        <Text style={webHomeStyles.homePromoSub}>
          Watch locker videos in the app.
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: c.sidebarActive }}>
          Open clips →
        </Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          webHomeStyles.homePromoHalf,
          pressed && { opacity: 0.9 },
        ]}
        onPress={onInvite}
        testID="invite-card-container"
      >
        <Ionicons name="mail-outline" size={26} color={c.iconPrimary} />
        <Text style={webHomeStyles.homePromoTitle}>Invite friends</Text>
        <Text style={webHomeStyles.homePromoSub}>
          Matches the web invite card on the dashboard home.
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: c.sidebarActive }}>
          Invite →
        </Text>
      </Pressable>
    </View>
  );
}
