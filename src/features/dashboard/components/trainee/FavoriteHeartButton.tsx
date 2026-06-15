import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useThemeColors, useThemedStyles } from "../../../../theme";
import { haptics } from "../../../../lib/haptics";

const BURST_COUNT = 6;

type Props = {
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  compact?: boolean;
};

type Particle = {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
};

function createParticles(): Particle[] {
  return Array.from({ length: BURST_COUNT }, (_, i) => ({
    id: i,
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0.3),
  }));
}

export function FavoriteHeartButton({
  active,
  onPress,
  accessibilityLabel,
  size = 22,
  compact = false,
}: Props) {
  const c = useThemeColors();
  const styles = useStyles(compact);
  const scale = useRef(new Animated.Value(1)).current;
  const [particles, setParticles] = useState<Particle[]>([]);
  const burstGen = useRef(0);

  const bump = () => {
    scale.setValue(0.82);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const runBurst = () => {
    burstGen.current += 1;
    const gen = burstGen.current;
    const next = createParticles();
    setParticles(next);

    const anims = next.map((p, i) => {
      const angle = (Math.PI * 2 * i) / BURST_COUNT + 0.2;
      const dist = 22 + (i % 2) * 8;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 6;
      p.x.setValue(0);
      p.y.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(0.4);
      return Animated.parallel([
        Animated.timing(p.x, { toValue: dx, duration: 420, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: dy, duration: 420, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(p.scale, { toValue: 0.9, duration: 420, useNativeDriver: true }),
      ]);
    });

    Animated.stagger(30, anims).start(() => {
      if (burstGen.current === gen) setParticles([]);
    });
  };

  const handlePress = () => {
    haptics.press();
    bump();
    if (!active) runBurst();
    onPress();
  };

  return (
    <View style={styles.wrap}>
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          pointerEvents="none"
          style={[
            styles.particle,
            {
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { scale: p.scale },
              ],
            },
          ]}
        >
          <Ionicons name="heart" size={10} color="#E53935" />
        </Animated.View>
      ))}
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={10}
      >
        <Animated.View
          style={[
            styles.circle,
            active && styles.circleActive,
            { transform: [{ scale }] },
          ]}
        >
          <Ionicons
            name={active ? "heart" : "heart-outline"}
            size={size}
            color={active ? "#E53935" : c.textMuted}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

function useStyles(compact: boolean) {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: {
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      },
      particle: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
      },
      circle: {
        width: compact ? 40 : 44,
        height: compact ? 40 : 44,
        borderRadius: compact ? 20 : 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      },
      circleActive: {
        backgroundColor: "#FFEBEE",
        borderColor: "#E53935",
      },
    })
  );
}
