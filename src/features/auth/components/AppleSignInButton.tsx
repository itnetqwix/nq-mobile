import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, Platform, Pressable, StyleSheet, Text } from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { radii, space, typography, useThemeColors } from "../../../theme";
import type { AuthScreenProps } from "../../../navigation/types";
import { postAppleVerify, signInWithAppleNative } from "../api/socialAuth";
import { setLastAuthMethod } from "../lib/lastAuthMethod";

type Props = {
  navigation: AuthScreenProps<"Login">["navigation"];
  onTokens: (tokens: { access_token: string; account_type: string }) => Promise<void>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
};

/**
 * Apple Sign In button — iOS only. Hidden on Android/web.
 * On tap: triggers native Apple authentication, then either logs the user
 * in immediately (existing account) or navigates to SignUp (new account).
 */
export function AppleSignInButton({ navigation, onTokens, busy, setBusy }: Props) {
  if (Platform.OS !== "ios") return null;
  return (
    <AppleSignInButtonInner
      navigation={navigation}
      onTokens={onTokens}
      busy={busy}
      setBusy={setBusy}
    />
  );
}

function AppleSignInButtonInner({ navigation, onTokens, busy, setBusy }: Props) {
  const c = useThemeColors();
  const { showLoader, hideLoader } = useLoader();

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
          appleIdentityToken: identityToken,
        } as never);
        return;
      }
      await setLastAuthMethod("apple");
      await onTokens(result);
    } catch (e) {
      Alert.alert("Apple Sign In failed", getApiErrorMessage(e));
    } finally {
      hideLoader();
      setBusy(false);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.socialBtn,
        { borderColor: c.border, backgroundColor: c.surface, opacity: busy ? 0.5 : 1 },
        pressed && !busy && { opacity: 0.88 },
      ]}
      onPress={handleApple}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Apple"
    >
      <Ionicons name="logo-apple" size={22} color={c.text} />
      <Text style={[styles.socialLabel, { color: c.text }]}>Apple</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  socialLabel: { ...typography.label, fontWeight: "700" },
});
