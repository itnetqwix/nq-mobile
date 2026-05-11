import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text } from "react-native";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { TextField } from "../../../components/ui/TextField";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { colors, space } from "../../../theme/tokens";
import { postForgotPassword } from "../api/authApi";
import type { AuthScreenProps } from "../../../navigation/types";

export function ForgotPasswordScreen({ navigation }: AuthScreenProps<"ForgotPassword">) {
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => postForgotPassword(email.trim()),
    onSuccess: () => {
      Alert.alert("Check your email", "If an account exists, reset instructions were sent.", [
        { text: "OK", onPress: () => navigation.navigate("Login") },
      ]);
    },
    onError: (err) => {
      Alert.alert("Request failed", getApiErrorMessage(err));
    },
  });

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <NetqwixLogo maxWidth={220} />
        <Text style={styles.headline}>Reset password</Text>
        <Text style={styles.sub}>We will email a link if this address is registered.</Text>
        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Button
          title="Send reset link"
          loading={mutation.isPending}
          disabled={!email.trim()}
          onPress={() => mutation.mutate()}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 22,
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
});
