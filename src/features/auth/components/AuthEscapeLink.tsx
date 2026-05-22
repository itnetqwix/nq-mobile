import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { useThemeColors, useThemedStyles } from "../../../theme";
import { useAuth } from "../context/AuthContext";

type Props = {
  /** When signed out, navigate to Login inside Auth stack. */
  onNavigateToLogin?: () => void;
  /** `signin` = go to login; `signout` = leave signed-in verification and return to auth. */
  variant?: "signin" | "signout";
};

/**
 * Lets users leave signup or post-login trainer verification and return to sign-in.
 */
export function AuthEscapeLink({ onNavigateToLogin, variant = "signout" }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const { status, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const label =
    variant === "signin" || status !== "signedIn"
      ? t("auth.backToSignIn")
      : t("auth.signInDifferentAccount");

  const handlePress = () => {
    if (status === "signedIn") {
      Alert.alert(t("auth.leaveVerificationTitle"), t("auth.leaveVerificationBody"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("auth.signOut"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await signOut();
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]);
      return;
    }
    onNavigateToLogin?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="arrow-back" size={18} color={c.brandAccent} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        marginBottom: 12,
        paddingVertical: 4,
      },
      text: {
        color: palette.brandAccent,
        fontSize: 15,
        fontWeight: "600",
      },
    })
  );
}
