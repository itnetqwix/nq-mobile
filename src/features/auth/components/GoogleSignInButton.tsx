import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { emailFromIdToken } from "../../../lib/jwt/decodeJwtPayload";
import { radii, space, typography, useThemeColors } from "../../../theme";
import type { AuthScreenProps } from "../../../navigation/types";
import { isGoogleConfiguredForPlatform, postGoogleVerify, useGoogleAuthRequest } from "../api/socialAuth";

type Props = {
  navigation: AuthScreenProps<"Login">["navigation"];
  onTokens: (tokens: { access_token: string; account_type: string }) => Promise<void>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  mode?: "login" | "signup";
};

/**
 * Google slot in the social row. Hook only runs when platform has a client ID.
 */
export function GoogleSignInButton({ navigation, onTokens, busy, setBusy, mode = "login" }: Props) {
  const c = useThemeColors();
  const { showLoader, hideLoader } = useLoader();

  if (!isGoogleConfiguredForPlatform()) {
    return <GooglePlaceholder busy={busy} />;
  }

  return (
    <GoogleSignInButtonInner
      navigation={navigation}
      onTokens={onTokens}
      busy={busy}
      setBusy={setBusy}
      mode={mode}
      c={c}
      showLoader={showLoader}
      hideLoader={hideLoader}
    />
  );
}

function GooglePlaceholder({ busy }: { busy: boolean }) {
  const c = useThemeColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.socialBtn,
        { borderColor: c.border, backgroundColor: c.surface, opacity: busy ? 0.5 : 1 },
        pressed && !busy && { opacity: 0.88 },
      ]}
      disabled={busy}
      onPress={() =>
        Alert.alert(
          "Google Sign In",
          "Add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (or use your web client ID in .env) and restart the app."
        )
      }
    >
      <Ionicons name="logo-google" size={22} color={c.text} />
      <Text style={[styles.socialLabel, { color: c.text }]}>Google</Text>
    </Pressable>
  );
}

function GoogleSignInButtonInner({
  navigation,
  onTokens,
  busy,
  setBusy,
  mode: _mode,
  c,
  showLoader,
  hideLoader,
}: Props & {
  c: ReturnType<typeof useThemeColors>;
  showLoader: (msg: string) => void;
  hideLoader: () => void;
}) {
  const [request, response, promptGoogle] = useGoogleAuthRequest();

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
          navigation.navigate("SignUp", {
            prefillEmail: result.email,
            ssoProvider: "google",
            isGoogleRegister: true,
          } as never);
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
  }, [response, navigation, onTokens, showLoader, hideLoader, setBusy]);

  const handleGoogle = async () => {
    if (!request) {
      Alert.alert("Google Sign In", "Google sign-in is still loading. Try again in a moment.");
      return;
    }
    await promptGoogle();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.socialBtn,
        { borderColor: c.border, backgroundColor: c.surface, opacity: busy ? 0.5 : 1 },
        pressed && !busy && { opacity: 0.88 },
      ]}
      onPress={handleGoogle}
      disabled={busy || !request}
    >
      <Ionicons name="logo-google" size={22} color={c.text} />
      <Text style={[styles.socialLabel, { color: c.text }]}>Google</Text>
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
