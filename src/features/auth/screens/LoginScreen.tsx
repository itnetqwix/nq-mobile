import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import {
  Button,
  FormField,
  ScreenContainer,
  Stack,
} from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { colors, space, typography } from "../../../theme";
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
    <ScreenContainer scroll applyTopInset padding="lg" background={colors.background}>
      <View style={styles.brand}>
        <NetqwixLogo maxWidth={240} />
      </View>
      <Text style={[typography.titleLg, { color: colors.text, marginTop: space.md }]}>
        Welcome back
      </Text>
      <Text style={[typography.bodyMd, { color: colors.textMuted, marginBottom: space.lg }]}>
        Sign in to continue to NetQwix.
      </Text>

      <Stack gap="md">
        <FormField
          label="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          required
        />
        <FormField
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          required
        />
        <Button
          label="Sign in"
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
          disabled={!email.trim() || !password}
          size="lg"
        />
      </Stack>

      <Pressable onPress={() => navigation.navigate("ForgotPassword")} style={styles.linkWrap}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("SignUp")} style={styles.linkWrap}>
        <Text style={styles.link}>Create an account</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginTop: space.lg },
  linkWrap: {
    marginTop: space.md,
    alignItems: "center",
  },
  link: {
    color: colors.brandAccent,
    fontSize: 15,
    fontWeight: "600",
  },
});
