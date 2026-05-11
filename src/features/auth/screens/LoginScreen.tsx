import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text } from "react-native";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { TextField } from "../../../components/ui/TextField";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { colors, space } from "../../../theme/tokens";
import { useAuth } from "../context/AuthContext";
import type { AuthScreenProps } from "../../../navigation/types";

export function LoginScreen({ navigation }: AuthScreenProps<"Login">) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => signIn(email.trim(), password),
    onError: (err) => {
      Alert.alert("Sign in failed", getApiErrorMessage(err, "Check your email and password."));
    },
  });

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <NetqwixLogo maxWidth={240} />
        <Text style={styles.headline}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to continue to NetQwix.</Text>
        <TextField
          label="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextField
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button
          title="Sign in"
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
          disabled={!email.trim() || !password}
        />
        <Pressable onPress={() => navigation.navigate("ForgotPassword")} style={styles.linkWrap}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("SignUp")} style={styles.linkWrap}>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  sub: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: space.lg,
  },
  linkWrap: {
    marginTop: space.md,
    alignItems: "center",
  },
  link: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
});
