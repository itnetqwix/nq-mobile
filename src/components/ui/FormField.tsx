import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../theme";

export type FormFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** Show a leading icon/badge slot. */
  leading?: React.ReactNode;
  /** Show a trailing slot (e.g. eye toggle, clear button). */
  trailing?: React.ReactNode;
};

/** Tokenised text input — replaces ad-hoc `TextInput` wrappers across forms. */
export function FormField({
  label,
  hint,
  error,
  required,
  containerStyle,
  inputStyle,
  leading,
  trailing,
  onFocus,
  onBlur,
  ...rest
}: FormFieldProps) {
  const c = useThemeColors();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.danger : focused ? c.brandAccent : c.inputBorder;

  const styles = useThemedStyles((colors) =>
    StyleSheet.create({
      wrap: { width: "100%" },
      label: { color: colors.text, marginBottom: 6 },
      inputWrap: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: radii.md,
        paddingHorizontal: space.sm,
        backgroundColor: colors.input,
      },
      adornment: {
        paddingHorizontal: 4,
        alignItems: "center",
        justifyContent: "center",
      },
    })
  );

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text style={[typography.label, styles.label]}>
          {label}
          {required ? <Text style={{ color: c.danger }}> *</Text> : null}
        </Text>
      ) : null}

      <View style={[styles.inputWrap, { borderColor }]}>
        {leading ? <View style={styles.adornment}>{leading}</View> : null}
        <TextInput
          placeholderTextColor={c.textMuted}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              fontSize: typography.bodyMd.fontSize,
              fontWeight: typography.bodyMd.fontWeight,
              fontFamily: typography.bodyMd.fontFamily,
              letterSpacing: typography.bodyMd.letterSpacing,
              color: c.text,
              flex: 1,
              paddingVertical: space.sm,
            },
            Platform.OS === "android" && !rest.multiline && { textAlignVertical: "center" },
            inputStyle,
          ]}
        />
        {trailing ? <View style={styles.adornment}>{trailing}</View> : null}
      </View>

      {error ? (
        <Text style={[typography.caption, { color: c.danger, marginTop: 4 }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[typography.caption, { color: c.textMuted, marginTop: 4 }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
