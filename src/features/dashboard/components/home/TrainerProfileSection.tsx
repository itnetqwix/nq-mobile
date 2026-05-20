import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { TrainerOnlineToggle } from "../TrainerOnlineToggle";
import { HomeSection } from "./HomeSection";
import { HomeUserAvatar } from "./HomeUserAvatar";

type Props = {
  name: string;
  accountType: string;
  profilePicture?: string;
  showAsOnline: boolean;
  onSettings: () => void;
  onAvailabilityToggle: (next: boolean) => Promise<void>;
};

export function TrainerProfileSection({
  name,
  accountType,
  profilePicture,
  showAsOnline,
  onSettings,
  onAvailabilityToggle,
}: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
      },
      meta: { flex: 1, minWidth: 0 },
      name: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      role: { ...typography.bodySm, color: palette.textMuted, marginTop: 4 },
      settingsLink: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 10,
        alignSelf: "flex-start",
        gap: 2,
      },
      settingsText: {
        ...typography.label,
        color: palette.sidebarActive,
        fontWeight: "600",
      },
      toggleWrap: {
        paddingHorizontal: space.md,
        paddingTop: space.xs,
        paddingBottom: space.sm,
      },
    })
  );

  return (
    <HomeSection
      title="Your profile"
      subtitle="Availability and account"
      testID="home-trainer-profile"
      compact
    >
      <View style={styles.row}>
        <HomeUserAvatar
          uri={profilePicture}
          name={name}
          size={64}
          onlineStatus={showAsOnline ? "online" : "offline"}
        />
        <View style={styles.meta}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{accountType}</Text>
          <Pressable style={styles.settingsLink} onPress={onSettings} hitSlop={8}>
            <Text style={styles.settingsText}>Account & settings</Text>
            <Ionicons name="chevron-forward" size={16} color={c.sidebarActive} />
          </Pressable>
        </View>
      </View>
      <View style={styles.toggleWrap}>
        <TrainerOnlineToggle value={showAsOnline} onToggle={onAvailabilityToggle} />
      </View>
    </HomeSection>
  );
}
