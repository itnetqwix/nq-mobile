import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { Button, FormField, ScreenContainer, Stack } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { colors, space, typography } from "../../../theme";
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
    <ScreenContainer scroll applyTopInset padding="lg" background={colors.background}>
      <View style={styles.brand}>
        <NetqwixLogo maxWidth={220} />
      </View>
      <Text style={[typography.titleLg, { color: colors.text, marginTop: space.md }]}>
        Reset password
      </Text>
      <Text style={[typography.bodyMd, { color: colors.textMuted, marginBottom: space.lg }]}>
        We will email a link if this address is registered.
      </Text>

      <Stack gap="md">
        <FormField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          required
        />
        <Button
          label="Send reset link"
          loading={mutation.isPending}
          disabled={!email.trim()}
          onPress={() => mutation.mutate()}
          size="lg"
        />
      </Stack>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginTop: space.lg },
});
