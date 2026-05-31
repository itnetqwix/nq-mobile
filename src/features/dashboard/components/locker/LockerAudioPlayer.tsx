import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { colors, space } from "../../../../theme";

type Props = {
  uri: string;
  title?: string;
};

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LockerAudioPlayer({ uri, title }: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      void sound?.unloadAsync();
    };
  }, [sound]);

  const toggle = useCallback(async () => {
    if (playing && sound) {
      await sound.pauseAsync();
      setPlaying(false);
      return;
    }
    if (sound) {
      await sound.playAsync();
      setPlaying(true);
      return;
    }
    setLoading(true);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (st) => {
          if (!st.isLoaded) return;
          setPos(st.positionMillis);
          setDur(st.durationMillis ?? 0);
          if (st.didJustFinish) {
            setPlaying(false);
            void s.setPositionAsync(0);
          }
        }
      );
      setSound(s);
      setPlaying(true);
    } catch {
      Alert.alert("Playback error", "Could not play this recording.");
    } finally {
      setLoading(false);
    }
  }, [playing, sound, uri]);

  const progress = dur > 0 ? Math.min(1, pos / dur) : 0;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => void toggle()}
        style={styles.playBtn}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause recording" : "Play recording"}
      >
        <Ionicons
          name={loading ? "hourglass-outline" : playing ? "pause" : "play"}
          size={28}
          color="#fff"
        />
      </Pressable>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {title ?? "Session recording"}
        </Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.time}>
          {formatMs(pos)}
          {dur > 0 ? ` / ${formatMs(dur)}` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandNavy,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flex: 1, gap: 6 },
  title: { color: "#fff", fontSize: 16, fontWeight: "600" },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: colors.brandAccent },
  time: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
});
