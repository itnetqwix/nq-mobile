import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { navigationRef } from "../../../navigation/navigationRef";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";
import {
  setLastInterruptedSession,
  useLastInterruptedSession,
} from "../callRejoinStore";
import { fetchSessionJoinReadiness } from "../sessionLiveApi";
import { SessionRejoinBlockedModal } from "./SessionRejoinBlockedModal";

/**
 * Slim banner that appears at the top of the dashboard when the most
 * recent meeting ended unexpectedly. Preflight checks join readiness
 * (departure rejoin blocks, call slot) before navigating back in.
 */
export function CallRejoinBanner() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const last = useLastInterruptedSession();
  const [checking, setChecking] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  if (!last) return null;

  const handleRejoin = async () => {
    if (checking) return;
    haptics.tap();
    setChecking(true);
    try {
      const readiness = await fetchSessionJoinReadiness(last.lessonId);
      if (!readiness || readiness.can_join === false) {
        if (readiness?.join_code === "departure_rejoin_blocked") {
          setBlockedReason(
            readiness.join_block_reason ??
              "You have another session during this time and cannot rejoin."
          );
          return;
        }
        Alert.alert(
          "Cannot rejoin",
          readiness?.join_block_reason ?? "This session is no longer available to join."
        );
        return;
      }
      if (navigationRef.isReady()) {
        navigationRef.navigate("Meeting", {
          lessonId: last.lessonId,
          skipLobby: true,
        });
      }
      setLastInterruptedSession(null);
    } catch {
      Alert.alert("Could not rejoin", "Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleDismiss = () => {
    setLastInterruptedSession(null);
  };

  return (
    <>
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
            {checking
              ? "Checking session…"
              : t("callRejoin.bannerBody", {
                  name: last.partnerName ?? "the session",
                })}
          </Text>
        </View>
        <View style={[styles.rejoinPill, { backgroundColor: c.warning }]}>
          <Text style={[styles.rejoinText, { color: c.brandTextOn }]}>
            {t("callRejoin.rejoinBtn")}
          </Text>
        </View>
        <Pressable onPress={handleDismiss} hitSlop={6} accessibilityLabel={t("callRejoin.dismiss")}>
          <Ionicons name="close" size={16} color={c.textMuted} />
        </Pressable>
      </Pressable>

      <SessionRejoinBlockedModal
        visible={!!blockedReason}
        reason={blockedReason ?? ""}
        onDismiss={() => setBlockedReason(null)}
      />
    </>
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
