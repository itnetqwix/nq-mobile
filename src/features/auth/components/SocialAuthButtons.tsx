import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { Button } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { emailFromIdToken } from "../../../lib/jwt/decodeJwtPayload";
import {
  isGoogleConfigured,
  postAppleVerify,
  postGoogleVerify,
  signInWithAppleNative,
  useGoogleAuthRequest,
} from "../api/socialAuth";
import type { AuthScreenProps } from "../../../navigation/types";

type Props = {
  navigation: AuthScreenProps<"Login">["navigation"];
  onTokens: (tokens: { access_token: string; account_type: string }) => Promise<void>;
};

export function SocialAuthButtons({ navigation, onTokens }: Props) {
  const c = useThemeColors();
  const { showLoader, hideLoader } = useLoader();
  const [request, response, promptGoogle] = useGoogleAuthRequest();
  const [busy, setBusy] = useState(false);
  const googleReady = isGoogleConfigured() && !!request;

  useEffect(() => {
    if (!response?.type || response.type !== "success") return;
    const idToken = response.authentication?.idToken;
    if (!idToken) return;
    void (async () => {
      setBusy(true);
      showLoader("Signing in with Google…");
      try {
        const resolvedEmail = emailFromIdToken(idToken);
        if (!resolvedEmail) {
          Alert.alert(
            "Google Sign In",
            "We could not read your email from Google. Please sign in with email and password."
          );
          return;
        }
        const result = await postGoogleVerify({
          email: resolvedEmail,
          id_token: idToken,
        });
        if (result.kind === "register_pending") {
          navigation.navigate("SignUp", { prefillEmail: result.email } as never);
          return;
        }
        await onTokens(result);
      } catch (e) {
        Alert.alert("Google Sign In failed", getApiErrorMessage(e));
      } finally {
        hideLoader();
        setBusy(false);
      }
    })();
  }, [response, navigation, onTokens, showLoader, hideLoader]);

  const handleGoogle = async () => {
    if (!googleReady) {
      Alert.alert(
        "Google Sign In",
        "Google OAuth is not configured. Add EXPO_PUBLIC_GOOGLE_*_CLIENT_ID to your environment."
      );
      return;
    }
    await promptGoogle();
  };

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
        navigation.navigate("SignUp", { prefillEmail: result.email } as never);
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
      {googleReady && (
        <Pressable
          style={({ pressed }) => [
            styles.socialBtn,
            { borderColor: c.border, backgroundColor: c.surface },
            pressed && { opacity: 0.88 },
          ]}
          onPress={handleGoogle}
          disabled={busy || !request}
        >
          <Ionicons name="logo-google" size={20} color={c.text} />
          <Text style={[styles.socialLabel, { color: c.text }]}>Google</Text>
        </Pressable>
      )}
      {Platform.OS === "ios" && (
        <Pressable
          style={({ pressed }) => [
            styles.socialBtn,
            { borderColor: c.border, backgroundColor: c.text, marginTop: space.sm },
            pressed && { opacity: 0.88 },
          ]}
          onPress={handleApple}
          disabled={busy}
        >
          <Ionicons name="logo-apple" size={22} color={c.background} />
          <Text style={[styles.socialLabel, { color: c.background }]}>Apple</Text>
        </Pressable>
      )}
      {busy && (
        <Button label="Signing in…" loading disabled fullWidth style={{ marginTop: space.sm }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { ...typography.caption, fontWeight: "600" },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  socialLabel: { ...typography.label, fontWeight: "700" },
});
