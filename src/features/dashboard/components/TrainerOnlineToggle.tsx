import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { setAutoDeclineOutsideHours } from "../../home/api/homeApi";

const ONLINE = {
  bg: "#E8F5E9",
  border: "#81C784",
  ring: "#4CAF50",
  dot: "#43A047",
  title: "#1B5E20",
  subtitle: "#2E7D32",
  switchTrack: "#66BB6A",
};

const OFFLINE = {
  bg: "#FFEBEE",
  border: "#EF9A9A",
  ring: "#E57373",
  dot: "#C62828",
  title: "#B71C1C",
  subtitle: "#C62828",
  switchTrack: "#E57373",
};

type Props = {
  value: boolean;
  onToggle: (next: boolean) => Promise<void>;
  /** Flush inside a parent card (no outer margin / radius). */
  embedded?: boolean;
};

export function TrainerOnlineToggle({ value, onToggle, embedded }: Props) {
  const { user, patchUser } = useAuth();
  const initialDecline =
    (user as { auto_decline_outside_business_hours?: boolean } | null | undefined)
      ?.auto_decline_outside_business_hours !== false;
  const [autoDecline, setAutoDecline] = useState<boolean>(initialDecline);
  const [autoDeclineSyncing, setAutoDeclineSyncing] = useState(false);
  const [displayOnline, setDisplayOnline] = useState(value);
  const [syncing, setSyncing] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const blend = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (autoDeclineSyncing) return;
    setAutoDecline(initialDecline);
  }, [initialDecline, autoDeclineSyncing]);

  const handleAutoDeclineToggle = useCallback(
    async (next: boolean) => {
      if (autoDeclineSyncing || next === autoDecline) return;
      const prev = autoDecline;
      setAutoDecline(next);
      setAutoDeclineSyncing(true);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const confirmed = await setAutoDeclineOutsideHours(next);
        setAutoDecline(confirmed);
        patchUser({ auto_decline_outside_business_hours: confirmed });
      } catch (e) {
        setAutoDecline(prev);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const message =
          e instanceof Error ? e.message : "Could not update business-hours rule.";
        Alert.alert("Business hours", message);
      } finally {
        setAutoDeclineSyncing(false);
      }
    },
    [autoDecline, autoDeclineSyncing, patchUser]
  );

  useEffect(() => {
    if (syncing) return;
    setDisplayOnline(value);
    blend.setValue(value ? 1 : 0);
  }, [value, syncing, blend]);

  useEffect(() => {
    Animated.timing(blend, {
      toValue: displayOnline ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [displayOnline, blend]);

  useEffect(() => {
    if (!displayOnline) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 1000, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [displayOnline, pulse]);

  const handleChange = useCallback(
    async (next: boolean) => {
      if (syncing || next === displayOnline) return;

      const previous = displayOnline;
      setDisplayOnline(next);
      setSyncing(true);

      try {
        await Haptics.impactAsync(
          next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        );
        await onToggle(next);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e: unknown) {
        setDisplayOnline(previous);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const message = e instanceof Error ? e.message : "Could not update online status.";
        Alert.alert("Online status", message);
      } finally {
        setSyncing(false);
      }
    },
    [displayOnline, onToggle, syncing]
  );

  const bgTint = blend.interpolate({
    inputRange: [0, 1],
    outputRange: [OFFLINE.bg, ONLINE.bg],
  });

  const borderTint = blend.interpolate({
    inputRange: [0, 1],
    outputRange: [OFFLINE.border, ONLINE.border],
  });

  const titleColor = blend.interpolate({
    inputRange: [0, 1],
    outputRange: [OFFLINE.title, ONLINE.title],
  });

  const subtitleColor = blend.interpolate({
    inputRange: [0, 1],
    outputRange: [OFFLINE.subtitle, ONLINE.subtitle],
  });

  const ringColor = blend.interpolate({
    inputRange: [0, 1],
    outputRange: [OFFLINE.ring, ONLINE.ring],
  });

  const dotColor = blend.interpolate({
    inputRange: [0, 1],
    outputRange: [OFFLINE.dot, ONLINE.dot],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        embedded && styles.cardEmbedded,
        {
          backgroundColor: bgTint,
          borderColor: borderTint,
        },
      ]}
    >
      <View
        style={styles.pressable}
        accessibilityRole="switch"
        accessibilityState={{ checked: displayOnline, busy: syncing }}
        accessibilityLabel={
          displayOnline ? "You are shown as online" : "You are shown as offline"
        }
      >
        <View style={styles.iconWrap}>
          {displayOnline ? (
            <Animated.View
              style={[
                styles.statusRing,
                {
                  backgroundColor: ringColor,
                  transform: [{ scale: pulse }],
                  opacity: pulse.interpolate({
                    inputRange: [1, 1.4],
                    outputRange: [0.4, 0],
                  }),
                },
              ]}
            />
          ) : null}
          <Animated.View style={[styles.statusDot, { backgroundColor: dotColor }]}>
            <Ionicons
              name={displayOnline ? "checkmark-circle" : "moon-outline"}
              size={22}
              color="#fff"
            />
          </Animated.View>
        </View>

        <Pressable
          style={styles.copy}
          onPress={() => handleChange(!displayOnline)}
          disabled={syncing}
        >
          <View style={styles.titleRow}>
            <Animated.Text style={[styles.title, { color: titleColor }]}>
              {displayOnline ? "You're online" : "You're offline"}
            </Animated.Text>
            {syncing ? (
              <ActivityIndicator
                size="small"
                color={displayOnline ? ONLINE.dot : OFFLINE.dot}
                style={styles.syncSpinner}
              />
            ) : null}
          </View>
          <Animated.Text style={[styles.subtitle, { color: subtitleColor }]}>
            {displayOnline
              ? "Visible in chat, booking, and to trainees browsing coaches"
              : "Hidden from online lists — you can still use the app normally"}
          </Animated.Text>
        </Pressable>

        <View
          style={[
            styles.switchWrap,
            { backgroundColor: displayOnline ? ONLINE.switchTrack : OFFLINE.switchTrack },
          ]}
        >
          <Switch
            value={displayOnline}
            onValueChange={handleChange}
            disabled={syncing}
            trackColor={{
              false: OFFLINE.switchTrack,
              true: ONLINE.switchTrack,
            }}
            thumbColor="#fff"
            ios_backgroundColor={displayOnline ? ONLINE.switchTrack : OFFLINE.switchTrack}
            style={styles.switch}
          />
        </View>
      </View>

      {displayOnline ? (
        <View style={styles.subrow}>
          <Ionicons
            name={autoDecline ? "shield-checkmark" : "shield-outline"}
            size={16}
            color={autoDecline ? ONLINE.dot : OFFLINE.dot}
          />
          <View style={styles.subrowText}>
            <Text style={styles.subrowTitle}>Decline outside business hours</Text>
            <Text style={styles.subrowHint}>
              {autoDecline
                ? "Instant requests outside your scheduled hours get auto-declined."
                : "You'll receive instant requests anytime you're online."}
            </Text>
          </View>
          {autoDeclineSyncing ? (
            <ActivityIndicator size="small" color={ONLINE.dot} />
          ) : (
            <Switch
              value={autoDecline}
              onValueChange={handleAutoDeclineToggle}
              trackColor={{ false: "#cfd8dc", true: ONLINE.switchTrack }}
              thumbColor="#fff"
              ios_backgroundColor="#cfd8dc"
              style={styles.switch}
            />
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  cardEmbedded: {
    marginTop: 0,
    borderRadius: 0,
    borderWidth: 0,
  },
  pressable: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
    minHeight: 76,
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  statusDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    paddingRight: space.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    ...typography.subtitle,
    fontWeight: "700",
  },
  syncSpinner: {
    marginLeft: 2,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 4,
    lineHeight: 18,
    opacity: 0.92,
  },
  switchWrap: {
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  switch: {
    transform: Platform.OS === "ios" ? [{ scaleX: 0.92 }, { scaleY: 0.92 }] : [],
    margin: Platform.OS === "ios" ? -2 : 0,
  },
  subrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: 4,
    paddingBottom: space.md,
  },
  subrowText: { flex: 1 },
  subrowTitle: { ...typography.bodySm, fontWeight: "700", color: "#1f2937" },
  subrowHint: { ...typography.caption, color: "#475569", marginTop: 2, lineHeight: 16 },
});
