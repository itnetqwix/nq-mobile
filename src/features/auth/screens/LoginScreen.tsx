import { useMutation } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { Button, FormField, PasswordVisibilityToggle, Stack } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { space, useThemeColors } from "../../../theme";
import { useAuth } from "../context/AuthContext";
import { AuthModalChrome } from "../components/AuthModalChrome";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import type { AuthScreenProps } from "../../../navigation/types";
import { promptEnableAppUnlock } from "../security/appUnlock";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen({ navigation }: AuthScreenProps<"Login">) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const { signIn, completeSessionFromTokens } = useAuth();
  const { showLoader, hideLoader } = useLoader();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const styles = StyleSheet.create({
    linkWrap: { marginTop: space.md, alignItems: "center" },
    link: { color: c.brandAccent, fontSize: 15, fontWeight: "600" },
  });

  const validate = () => {
    let ok = true;
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t("auth.emailInvalid"));
      ok = false;
    } else setEmailError(undefined);
    if (!password) {
      setPasswordError(t("auth.passwordRequired"));
      ok = false;
    } else setPasswordError(undefined);
    return ok;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("validation");
      showLoader(t("auth.signingIn"));
      await signIn(email.trim(), password);
      await promptEnableAppUnlock();
    },
    onError: (err) => {
      if ((err as Error).message === "validation") return;
      Alert.alert(
        t("auth.signInFailed"),
        getApiErrorMessage(err, t("auth.signInFailedBody"))
      );
    },
    onSettled: () => hideLoader(),
  });

  const onSocialTokens = useMemo(
    () => async (tokens: { access_token: string; account_type: string }) => {
      showLoader(t("auth.signingIn"));
      try {
        await completeSessionFromTokens(tokens);
        await promptEnableAppUnlock();
      } finally {
        hideLoader();
      }
    },
    [completeSessionFromTokens, showLoader, hideLoader, t]
  );

  return (
    <AuthModalChrome>
    <AuthScreenLayout
      title={t("auth.welcomeBack")}
      subtitle={t("auth.signInSubtitle")}
      footer={
        <>
          <Pressable
            onPress={() => navigation.navigate("ForgotPassword")}
            style={styles.linkWrap}
            accessibilityRole="link"
          >
            <Text style={styles.link}>{t("auth.forgotPassword")}</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("SignUp")}
            style={styles.linkWrap}
            accessibilityRole="link"
          >
            <Text style={styles.link}>{t("auth.createAccountLink")}</Text>
          </Pressable>
        </>
      }
    >
      <Stack gap="md">
        <FormField
          label={t("auth.email")}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (emailError) setEmailError(undefined);
          }}
          error={emailError}
          required
        />
        <FormField
          label={t("auth.password")}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (passwordError) setPasswordError(undefined);
          }}
          error={passwordError}
          required
          trailing={
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          }
        />
        <Button
          label={t("auth.signIn")}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
          disabled={!email.trim() || !password}
          size="lg"
        />
        <SocialAuthButtons navigation={navigation} onTokens={onSocialTokens} />
      </Stack>
    </AuthScreenLayout>
    </AuthModalChrome>
  );
}
