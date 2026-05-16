import React from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { radii, space, useThemeColors, useThemedStyles } from "../../theme";

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, ...rest }: Props) {
  const c = useThemeColors();
  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      wrap: {
        marginBottom: space.md,
      },
      label: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
        marginBottom: space.sm,
      },
      input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.md,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.text,
        backgroundColor: colors.background,
      },
      inputError: {
        borderColor: colors.danger,
      },
      error: {
        marginTop: space.xs,
        fontSize: 12,
        color: colors.danger,
      },
    })
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
