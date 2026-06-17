import * as AppleAuthentication from "expo-apple-authentication";
import React, { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { space } from "../../../theme";
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
 * Apple Sign In — iOS only, uses the native Apple button when available.
 */
export function AppleSignInButton({ navigation, onTokens, busy, setBusy }: Props) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);

  if (Platform.OS !== "ios" || !available) return null;

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
    <View style={[styles.wrap, busy && styles.disabled]} pointerEvents={busy ? "none" : "auto"}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={12}
        style={styles.nativeBtn}
        onPress={handleApple}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 52, justifyContent: "center" },
  disabled: { opacity: 0.5 },
  nativeBtn: { width: "100%", height: 52 },
});
