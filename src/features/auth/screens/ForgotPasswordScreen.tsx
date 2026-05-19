import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { Button, FormField, ScreenContainer, Stack } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { colors, space, typography } from "../../../theme";
import { postForgotPassword } from "../api/authApi";
import type { AuthScreenProps } from "../../../navigation/types";

export function ForgotPasswordScreen({ navigation }: AuthScreenProps<"ForgotPassword">) {
  const { t } = useAppTranslation();
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => postForgotPassword(email.trim()),
    onSuccess: () => {
      Alert.alert(t("auth.checkEmailTitle"), t("auth.resetEmailSentBody"), [
        { text: t("auth.ok"), onPress: () => navigation.navigate("Login") },
      ]);
    },
    onError: (err) => {
      Alert.alert(t("auth.requestFailed"), getApiErrorMessage(err));
    },
  });

  return (
    <ScreenContainer scroll applyTopInset padding="lg" background={colors.background}>
      <View style={styles.brand}>
        <NetqwixLogo maxWidth={220} />
      </View>
      <Text style={[typography.titleLg, { color: colors.text, marginTop: space.md }]}>
        {t("auth.resetPassword")}
      </Text>
      <Text style={[typography.bodyMd, { color: colors.textMuted, marginBottom: space.lg }]}>
        {t("auth.resetPasswordSubtitle")}
      </Text>

      <Stack gap="md">
        <FormField
          label={t("auth.email")}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          required
        />
        <Button
          label={t("auth.sendResetLink")}
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
