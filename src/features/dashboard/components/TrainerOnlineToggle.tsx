import { Ionicons } from "@expo/vector-icons";
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
import { haptics } from "../../../lib/haptics";

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
  const [displayOnline, setDisplayOnline] = useState(value);
  const [syncing, setSyncing] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const blend = useRef(new Animated.Value(value ? 1 : 0)).current;

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
        haptics.impact();
        await onToggle(next);
        haptics.success();
      } catch (e: unknown) {
        setDisplayOnline(previous);
        haptics.error();
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
              size={16}
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
          {displayOnline ? (
            <Animated.Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={2}>
              Reopen the app within 15 minutes to stay visible for instant lessons.
            </Animated.Text>
          ) : null}
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
    paddingVertical: 10,
    paddingHorizontal: space.md,
    gap: space.sm,
    minHeight: 52,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRing: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  statusDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    ...typography.bodySm,
    fontWeight: "700",
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
    lineHeight: 15,
    fontWeight: "500",
  },
  syncSpinner: {
    marginLeft: 2,
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
});
