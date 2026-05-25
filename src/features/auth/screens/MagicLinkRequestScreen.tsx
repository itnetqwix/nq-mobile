import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, FormField, Stack } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { space, typography, useThemeColors } from "../../../theme";
import { postMagicLinkRequest } from "../api/magicLinkApi";
import { AuthModalChrome } from "../components/AuthModalChrome";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import type { AuthScreenProps } from "../../../navigation/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step 1 of the magic-link sign-in. We collect the email and ask the
 * backend to send a one-time link + code. The backend is intentionally
 * vague on success ("if the email is registered…") so we don't leak
 * account existence here either.
 */
export function MagicLinkRequestScreen({
  navigation,
  route,
}: AuthScreenProps<"MagicLinkRequest">) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const [email, setEmail] = useState(route.params?.prefillEmail ?? "");
  const [error, setError] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: () => postMagicLinkRequest(email.trim()),
    onSuccess: (data) => {
      navigation.replace("MagicLinkVerify", {
        email: email.trim(),
        expiresInMinutes: data.expires_in_minutes,
      });
    },
    onError: (err) => {
      Alert.alert(
        t("auth.magicLink.failedTitle"),
        getApiErrorMessage(err, t("auth.magicLink.failedBody"))
      );
    },
  });

  const submit = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError(t("auth.emailInvalid"));
      return;
    }
    setError(undefined);
    mutation.mutate();
  };

  return (
    <AuthModalChrome>
      <AuthScreenLayout
        title={t("auth.magicLink.title")}
        subtitle={t("auth.magicLink.subtitle")}
        footer={
          <Pressable
            onPress={() => navigation.navigate("Login")}
            style={styles.linkWrap}
            accessibilityRole="link"
          >
            <Text style={[styles.link, { color: c.brandAccent }]}>
              {t("auth.magicLink.backToOptions")}
            </Text>
          </Pressable>
        }
      >
        <View style={[styles.featureCard, { borderColor: c.borderSubtle, backgroundColor: c.surfaceElevated }]}>
          <Row icon="flash-outline" text={t("auth.magicLink.featurePoint1")} color={c.brandAccent} />
          <Row icon="lock-closed-outline" text={t("auth.magicLink.featurePoint2")} color={c.brandAccent} />
          <Row icon="mail-outline" text={t("auth.magicLink.featurePoint3")} color={c.brandAccent} />
        </View>

        <Stack gap="md">
          <FormField
            label={t("auth.email")}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(undefined);
            }}
            error={error}
            required
          />
          <Button
            label={t("auth.magicLink.requestCta")}
            leftIcon="mail-outline"
            loading={mutation.isPending}
            disabled={!email.trim()}
            onPress={submit}
            size="lg"
          />
        </Stack>
      </AuthScreenLayout>
    </AuthModalChrome>
  );
}

function Row({
  icon,
  text,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
}) {
  const c = useThemeColors();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.rowText, { color: c.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  featureCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: space.md,
    gap: 10,
    marginBottom: space.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowText: { ...typography.bodySm, flex: 1 },
  linkWrap: { marginTop: space.md, alignItems: "center" },
  link: { fontSize: 15, fontWeight: "600" },
});
