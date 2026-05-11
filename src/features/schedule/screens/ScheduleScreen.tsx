import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../components/ui/Screen";
import { colors, space } from "../../../theme/tokens";
import type { MainTabScreenProps } from "../../../navigation/types";

/**
 * Parity target: `nq-frontend-main` `/dashboard/schedule` (calendar, blocks, booking requests).
 */
export function ScheduleScreen(_props: MainTabScreenProps<"Schedule">) {
  return (
    <Screen scroll>
      <View style={styles.box}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.body}>
          This tab replaces the web “Schedule” dashboard page. Next step is to wire the same APIs
          the website uses for availability and calendar events, with a touch-first week or agenda
          layout.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: space.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginBottom: space.md,
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
