import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
import { isGoogleConfiguredForPlatform } from "../api/socialAuth";
import { peekLastAuthMethod } from "../lib/lastAuthMethod";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { AppleSignInButton } from "./AppleSignInButton";
import type { AuthScreenProps } from "../../../navigation/types";

type Props = {
  navigation: AuthScreenProps<"Login">["navigation"];
  onTokens: (tokens: { access_token: string; account_type: string }) => Promise<void>;
  mode?: "login" | "signup";
};

/**
 * Social sign-in row — Google (all platforms) + Apple (iOS only).
 */
export function SocialAuthButtons({ navigation, onTokens, mode = "login" }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const hasGoogle = isGoogleConfiguredForPlatform();
  const hasApple = Platform.OS === "ios" && appleAvailable;

  if (!hasGoogle && !hasApple) {
    return null;
  }

  const lastMethod = peekLastAuthMethod();

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text style={[styles.or, { color: c.textMuted }]}>
          {t("auth.orContinueWith", { defaultValue: "or continue with" })}
        </Text>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>

      <View style={styles.providerRow}>
        {hasGoogle ? (
          <View style={styles.providerSlot}>
            <GoogleSignInButton
              navigation={navigation}
              onTokens={onTokens}
              busy={busy}
              setBusy={setBusy}
              mode={mode}
            />
            {lastMethod === "google" ? <LastUsedBadge label={t("auth.lastUsed")} /> : null}
          </View>
        ) : null}
        {hasApple ? (
          <View style={styles.providerSlot}>
            <AppleSignInButton
              navigation={navigation}
              onTokens={onTokens}
              busy={busy}
              setBusy={setBusy}
            />
            {lastMethod === "apple" ? <LastUsedBadge label={t("auth.lastUsed")} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function LastUsedBadge({ label }: { label: string }) {
  const c = useThemeColors();
  return (
    <View style={[styles.lastUsedPill, { backgroundColor: c.brandAccent }]}>
      <Text style={styles.lastUsedText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.md,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { ...typography.caption, fontWeight: "600" },
  providerRow: { flexDirection: "row", gap: space.sm },
  providerSlot: { flex: 1, gap: 6, alignItems: "stretch" },
  lastUsedPill: {
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  lastUsedText: { color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.4 },
});
