import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { Button, FormField, PasswordVisibilityToggle, Stack } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { space, typography, useThemeColors } from "../../../theme";
import { useAuth } from "../context/AuthContext";
import { AuthModalChrome } from "../components/AuthModalChrome";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { HomeBannerStrip } from "../../content/components/HomeBannerStrip";
import type { AuthScreenProps } from "../../../navigation/types";
import { exitAuthAsGuest } from "../lib/exitAuthAsGuest";
import { promptEnableAppUnlock } from "../security/appUnlock";
import { peekLastAuthMethod, setLastAuthMethod } from "../lib/lastAuthMethod";

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

  const lastMethod = peekLastAuthMethod();

  const styles = StyleSheet.create({
    linkWrap: { marginTop: space.md, alignItems: "center" },
    link: { color: c.brandAccent, fontSize: 15, fontWeight: "600" },
    guestRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: space.sm,
      paddingVertical: 8,
    },
    guestText: { color: c.textMuted, fontSize: 14 },
    guestLink: { color: c.brandAccent, fontSize: 14, fontWeight: "700" },
    lastUsedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.brandAccentSubtle,
      borderColor: c.brandAccent,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: space.md,
      paddingVertical: 10,
      marginBottom: space.sm,
    },
    lastUsedText: { ...typography.bodySm, color: c.brandNavy, fontWeight: "600", flex: 1 },
    magicLinkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      paddingVertical: space.md,
      paddingHorizontal: space.md,
      borderRadius: 12,
      borderWidth: 1,
    },
    magicLinkText: { fontSize: 15, fontWeight: "700", flex: 1 },
    lastUsedPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    lastUsedPillText: { color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.3 },
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
      await setLastAuthMethod("password");
      await promptEnableAppUnlock();
    },
    onSuccess: () => {
      const parent = navigation.getParent();
      if (parent?.canGoBack()) {
        parent.goBack();
      }
    },
    onError: (err) => {
      if ((err as Error).message === "validation") return;
      const enriched = err as Error & {
        accountState?: string | null;
        wakeUpRequired?: boolean;
        pendingDeletion?: boolean;
      };
      if (enriched.wakeUpRequired || enriched.accountState === "hibernated") {
        navigation.navigate("WakeUp", { contact: email.trim() });

        return;
      }
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
            onPress={() => exitAuthAsGuest(navigation)}
            style={styles.guestRow}
            accessibilityRole="link"
            accessibilityLabel={t("auth.continueAsGuest")}
          >
            <Ionicons name="compass-outline" size={16} color={c.brandAccent} />
            <Text style={styles.guestText}>{t("auth.continueAsGuestPrefix")}</Text>
            <Text style={styles.guestLink}>{t("auth.continueAsGuest")}</Text>
          </Pressable>
        </>
      }
    >
      <Stack gap="md">
        <HomeBannerStrip
          guest
          onDeepLink={(url) => {
            try {
              if (url.includes("wake-up")) {
                navigation.navigate("WakeUp" as never);
              }
            } catch {
              /* ignore — banners often link out */
            }
          }}
        />
        {lastMethod ? (
          <View style={styles.lastUsedBanner}>
            <Ionicons
              name={
                lastMethod === "google"
                  ? "logo-google"
                  : lastMethod === "magic-link"
                  ? "link"
                  : "mail-outline"
              }
              size={16}
              color={c.brandNavy}
            />
            <Text style={styles.lastUsedText} numberOfLines={2}>
              {t(`auth.lastUsedHint.${lastMethod}`)}
            </Text>
          </View>
        ) : null}
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
        <Pressable
          onPress={() =>
            navigation.navigate("MagicLinkRequest", {
              prefillEmail: email.trim() || undefined,
            })
          }
          style={({ pressed }) => [
            styles.magicLinkBtn,
            {
              borderColor: lastMethod === "magic-link" ? c.brandAccent : c.border,
              backgroundColor: c.surfaceElevated,
            },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
        >
          <Ionicons name="mail-outline" size={18} color={c.brandAccent} />
          <Text style={[styles.magicLinkText, { color: c.text }]}>
            {t("auth.magicLink.entryCta")}
          </Text>
          {lastMethod === "magic-link" ? (
            <View style={[styles.lastUsedPill, { backgroundColor: c.brandAccent }]}>
              <Ionicons name="checkmark-circle" size={11} color="#fff" />
              <Text style={styles.lastUsedPillText}>{t("auth.lastUsed")}</Text>
            </View>
          ) : null}
        </Pressable>
        <SocialAuthButtons navigation={navigation} onTokens={onSocialTokens} />
      </Stack>
    </AuthScreenLayout>
    </AuthModalChrome>
  );
}
