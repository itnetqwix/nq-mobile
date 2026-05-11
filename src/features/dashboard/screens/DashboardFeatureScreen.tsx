import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../components/ui/Screen";
import { colors, space } from "../../../theme/tokens";
import type { MenuStackParamList } from "../../../navigation/types";
import { dashboardRouteById } from "../config/dashboardRoutes";

export type DashboardFeatureScreenProps = NativeStackScreenProps<MenuStackParamList, "DashboardFeature">;

export function DashboardFeatureScreen({ route }: DashboardFeatureScreenProps) {
  const { featureId } = route.params;
  const meta = dashboardRouteById(featureId);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>{meta?.title ?? "Dashboard"}</Text>
        {meta?.webPath ? (
          <Text style={styles.path} accessibilityLabel="Web app path">
            Web: {meta.webPath}
          </Text>
        ) : null}
      </View>
      <Text style={styles.body}>
        {meta?.subtitle ??
          "This area will call the same APIs as the website, with mobile-first UI. Implementation is tracked per feature."}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: space.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  path: {
    marginTop: space.xs,
    fontSize: 13,
    color: colors.textMuted,
  },
  body: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
