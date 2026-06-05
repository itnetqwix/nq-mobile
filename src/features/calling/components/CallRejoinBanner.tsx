import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { navigationRef } from "../../../navigation/navigationRef";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";
import {
  setLastInterruptedSession,
  useLastInterruptedSession,
} from "../callRejoinStore";

/**
 * Slim banner that appears at the top of the dashboard when the most
 * recent meeting ended unexpectedly. Tapping it deep-links back into
 * the same lesson with `skipLobby: true` so the user re-enters the call
 * instantly. Dismissable so people aren't haunted by an old drop.
 */
export function CallRejoinBanner() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const last = useLastInterruptedSession();

  if (!last) return null;

  const handleRejoin = () => {
    haptics.tap();
    if (navigationRef.isReady()) {
      navigationRef.navigate("Meeting", {
        lessonId: last.lessonId,
        skipLobby: true,
      });
    }
    setLastInterruptedSession(null);
  };

  const handleDismiss = () => {
    setLastInterruptedSession(null);
  };

  return (
    <Pressable
      onPress={handleRejoin}
      style={[styles.banner, { borderColor: c.warning, backgroundColor: `${c.warning}1a` }]}
      accessibilityRole="button"
      accessibilityLabel={t("callRejoin.rejoinBtn")}
    >
      <View style={[styles.iconWrap, { backgroundColor: c.warning }]}>
        <Ionicons name="reload" size={14} color={c.brandTextOn} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.text }]}>
          {t("callRejoin.bannerTitle")}
        </Text>
        <Text style={[styles.body, { color: c.textMuted }]}>
          {t("callRejoin.bannerBody", {
            name: last.partnerName ?? "the session",
          })}
        </Text>
      </View>
      <View style={[styles.rejoinPill, { backgroundColor: c.warning }]}>
        <Text style={[styles.rejoinText, { color: c.brandTextOn }]}>
          {t("callRejoin.rejoinBtn")}
        </Text>
      </View>
      <Pressable
        onPress={handleDismiss}
        hitSlop={6}
        accessibilityLabel={t("callRejoin.dismiss")}
      >
        <Ionicons name="close" size={16} color={c.textMuted} />
      </Pressable>
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles(() =>
    StyleSheet.create({
      banner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: space.sm,
        paddingVertical: 10,
        borderRadius: radii.md,
        borderWidth: 1,
      },
      iconWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
      },
      title: { ...typography.bodySm, fontWeight: "800" },
      body: { ...typography.caption, marginTop: 2 },
      rejoinPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
      },
      rejoinText: { fontSize: 11, fontWeight: "800" },
    })
  );
}
