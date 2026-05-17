import { useMutation } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { Button, FormField, PasswordVisibilityToggle, Stack } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { space, useThemeColors } from "../../../theme";
import { useAuth } from "../context/AuthContext";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import type { AuthScreenProps } from "../../../navigation/types";
import { promptEnableAppUnlock } from "../security/appUnlock";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen({ navigation }: AuthScreenProps<"Login">) {
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
      setEmailError("Enter a valid email address");
      ok = false;
    } else setEmailError(undefined);
    if (!password) {
      setPasswordError("Password is required");
      ok = false;
    } else setPasswordError(undefined);
    return ok;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("validation");
      showLoader("Signing you in…");
      await signIn(email.trim(), password);
      await promptEnableAppUnlock();
    },
    onError: (err) => {
      if ((err as Error).message === "validation") return;
      Alert.alert("Sign in failed", getApiErrorMessage(err, "Check your email and password."));
    },
    onSettled: () => hideLoader(),
  });

  const onSocialTokens = useMemo(
    () => async (tokens: { access_token: string; account_type: string }) => {
      showLoader("Signing you in…");
      try {
        await completeSessionFromTokens(tokens);
        await promptEnableAppUnlock();
      } finally {
        hideLoader();
      }
    },
    [completeSessionFromTokens, showLoader, hideLoader]
  );

  return (
    <AuthScreenLayout
      title="Welcome back"
      subtitle="Sign in to continue training on NetQwix."
      footer={
        <>
          <Pressable
            onPress={() => navigation.navigate("ForgotPassword")}
            style={styles.linkWrap}
            accessibilityRole="link"
          >
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("SignUp")}
            style={styles.linkWrap}
            accessibilityRole="link"
          >
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </>
      }
    >
      <Stack gap="md">
        <FormField
          label="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            if (emailError) setEmailError(undefined);
          }}
          error={emailError}
          required
        />
        <FormField
          label="Password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
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
          label="Sign in"
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
          disabled={!email.trim() || !password}
          size="lg"
        />
        <SocialAuthButtons navigation={navigation} onTokens={onSocialTokens} />
      </Stack>
    </AuthScreenLayout>
  );
}
