import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { space, typography, useThemeColors } from "../../../theme";
import { getRememberDevice, setRememberDevice } from "../navigation/linkActions";

type Props = {
  label: string;
};

/** Toggles trusted-device preference without a separate action button. */
export function RememberDeviceCheckbox({ label }: Props) {
  const c = useThemeColors();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getRememberDevice().then((on) => {
      if (!cancelled) setChecked(on);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = useCallback(() => {
    void (async () => {
      const next = !checked;
      setChecked(next);
      await setRememberDevice(next);
    })();
  }, [checked]);

  return (
    <Pressable
      onPress={onToggle}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={22}
        color={checked ? c.brandNavy : c.textMuted}
      />
      <Text style={[typography.bodyMd, styles.label, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    alignSelf: "stretch",
    paddingVertical: space.xs,
  },
  label: { flex: 1 },
});
