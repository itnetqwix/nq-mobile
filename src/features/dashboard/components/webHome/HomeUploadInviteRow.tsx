import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { webHomeStyles } from "./webHomeStyles";
import { colors } from "../../../../theme/tokens";

type Props = {
  onUploads: () => void;
  onInvite: () => void;
};

/**
 * Web locker home pairs `UploadClipCard` (`upload-clip-container`) and
 * `InviteFriendsCard` (`invite-card-container`) in the right column (`NavHomePage`).
 */
export function HomeUploadInviteRow({ onUploads, onInvite }: Props) {
  return (
    <View style={webHomeStyles.homePromoRow}>
      <Pressable
        style={({ pressed }) => [
          webHomeStyles.homePromoHalf,
          pressed && { opacity: 0.9 },
        ]}
        onPress={onUploads}
        testID="upload-clip-container"
      >
        <Ionicons name="cloud-upload-outline" size={26} color={colors.brandNavy} />
        <Text style={webHomeStyles.homePromoTitle}>Upload clips</Text>
        <Text style={webHomeStyles.homePromoSub}>
          Same locker flow as the web “My Uploads” panel.
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.sidebarActive }}>
          Open uploads →
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
        <Ionicons name="mail-outline" size={26} color={colors.brandNavy} />
        <Text style={webHomeStyles.homePromoTitle}>Invite friends</Text>
        <Text style={webHomeStyles.homePromoSub}>
          Matches the web invite card on the dashboard home.
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.sidebarActive }}>
          Invite →
        </Text>
      </Pressable>
    </View>
  );
}
