import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { isGoogleConfigured, postAppleVerify, signInWithAppleNative } from "../api/socialAuth";
import { GoogleSignInButton } from "./GoogleSignInButton";
import type { AuthScreenProps } from "../../../navigation/types";

type Props = {
  navigation: AuthScreenProps<"Login">["navigation"];
  onTokens: (tokens: { access_token: string; account_type: string }) => Promise<void>;
  mode?: "login" | "signup";
};

export function SocialAuthButtons({ navigation, onTokens, mode = "login" }: Props) {
  const c = useThemeColors();
  const { showLoader, hideLoader } = useLoader();
  const [busy, setBusy] = useState(false);

  const showApple = Platform.OS === "ios";
  const showGoogle = isGoogleConfigured();

  if (!showApple && !showGoogle) {
    return null;
  }

  const handleApple = async () => {
    setBusy(true);
    showLoader("Signing in with Apple…");
    try {
      const { identityToken, email } = await signInWithAppleNative();
      const result = await postAppleVerify({
        identity_token: identityToken,
        email: email ?? undefined,
      });
      if (result.kind === "register_pending") {
        navigation.navigate("SignUp", {
          prefillEmail: result.email,
          ssoProvider: "apple",
          isGoogleRegister: true,
        } as never);
        return;
      }
      await onTokens(result);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("Apple Sign In failed", getApiErrorMessage(e));
    } finally {
      hideLoader();
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text style={[styles.or, { color: c.textMuted }]}>or continue with</Text>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>

      <View style={styles.socialRow}>
        {showGoogle ? (
          <GoogleSignInButton
            navigation={navigation}
            onTokens={onTokens}
            busy={busy}
            setBusy={setBusy}
            mode={mode}
          />
        ) : null}
        {showApple ? (
          <Pressable
            style={({ pressed }) => [
              styles.socialBtn,
              { borderColor: c.border, backgroundColor: c.text, opacity: busy ? 0.5 : 1 },
              !showGoogle && styles.socialBtnFull,
              pressed && !busy && { opacity: 0.88 },
            ]}
            onPress={handleApple}
            disabled={busy}
          >
            <Ionicons name="logo-apple" size={22} color={c.background} />
            <Text style={[styles.socialLabel, { color: c.background }]}>Apple</Text>
          </Pressable>
        ) : null}
      </View>
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
  socialRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: space.sm,
  },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 52,
  },
  socialBtnFull: {
    flex: 1,
  },
  socialLabel: { ...typography.label, fontWeight: "700" },
});
