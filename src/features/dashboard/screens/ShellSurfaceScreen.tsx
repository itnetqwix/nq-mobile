import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../components/ui/Screen";
import { colors, space } from "../../../theme/tokens";
import type { MenuStackParamList } from "../../../navigation/types";
import { shellSurfaceById } from "../config/shellSurfaces";

export type ShellSurfaceScreenProps = NativeStackScreenProps<MenuStackParamList, "ShellSurface">;

export function ShellSurfaceScreen({ route }: ShellSurfaceScreenProps) {
  const { surfaceId } = route.params;
  const meta = shellSurfaceById(surfaceId);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.title}>{meta?.title ?? "NetQwix"}</Text>
      </View>
      <Text style={styles.body}>
        {meta?.subtitle ?? "This section will use the same services as the website."}
      </Text>
      {meta?.webContext ? (
        <Text style={styles.hint} accessibilityLabel="Web parity note">
          {meta.webContext}
        </Text>
      ) : null}
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
  body: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  hint: {
    marginTop: space.lg,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    fontStyle: "italic",
  },
});
