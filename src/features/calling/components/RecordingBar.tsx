/**
 * RecordingBar — visual indicator that the instant lesson is being recorded.
 *
 * Web reference: `nq-frontend-main/app/components/portrait-calling/InstantLessonRecordingBar.jsx`.
 *
 * Note on scope: full screen capture / multi-track recording requires native
 * modules (`react-native-screen-recorder` on iOS is no longer maintained,
 * Android needs a foreground service + MediaProjection). For the first cut we
 * surface the same UI the web uses — a recording chip with a pulsing red dot,
 * elapsed time, and a "stop" button — and emit
 * `EVENTS.INSTANT_LESSON.SESSION_RECORDING` so the server-side instant lesson
 * pipeline picks up the upload via the existing
 * `pushSessionRecordingToS3` route. The actual track-mux capture lives behind
 * a feature flag and is a follow-up.
 */

import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  active: boolean;
  onStop?: () => void;
};

export function RecordingBar({ active, onStop }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const startedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      startedAt.current = null;
      setElapsed(0);
      return;
    }
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (!startedAt.current) return;
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      clearInterval(id);
      loop.stop();
    };
  }, [active, pulse]);

  if (!active) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.chip}>
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
        <Text style={styles.label}>
          REC {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </Text>
        {onStop ? (
          <Pressable onPress={onStop} hitSlop={6} style={styles.stop}>
            <Ionicons name="stop" size={14} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 76,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 25,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#e53935" },
  label: { color: "#fff", fontSize: 13, fontFamily: "Menlo", fontWeight: "700" },
  stop: {
    marginLeft: 6,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
});
