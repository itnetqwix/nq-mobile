import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { floatingTabBarBottomInset } from "../../../../navigation/FloatingTabBar";
import { radii, space, useThemeColors, useThemedStyles } from "../../../../theme";
import { TrainerRecentTraineesSection } from "./TrainerRecentTraineesSection";

type Props = {
  trainees: Record<string, unknown>[];
  onSelectTrainee?: (trainee: Record<string, unknown>) => void;
};

/**
 * Pinned horizontal strip above the bottom tab bar on trainer home.
 */
export function TrainerRecentEnthusiastsStickyBar({ trainees, onSelectTrainee }: Props) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useStyles();

  if (!trainees.length) return null;

  const bottom = floatingTabBarBottomInset(insets.bottom) - space.xs;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom }]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: c.surfaceElevated,
            borderColor: c.borderSubtle,
          },
        ]}
      >
        <TrainerRecentTraineesSection
          trainees={trainees}
          onSelectTrainee={onSelectTrainee}
        />
      </View>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      host: {
        position: "absolute",
        left: 0,
        right: 0,
        zIndex: 20,
      },
      card: {
        marginHorizontal: space.sm,
        borderRadius: radii.lg,
        borderWidth: 1,
        paddingTop: space.sm,
        paddingBottom: space.xs,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 6,
      },
    })
  );
}
