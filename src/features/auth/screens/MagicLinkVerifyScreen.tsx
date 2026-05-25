import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from "react-native";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { Button } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { space, typography, useThemeColors } from "../../../theme";
import { postMagicLinkRequest, postMagicLinkVerify } from "../api/magicLinkApi";
import { AuthModalChrome } from "../components/AuthModalChrome";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { useAuth } from "../context/AuthContext";
import { setLastAuthMethod } from "../lib/lastAuthMethod";
import { promptEnableAppUnlock } from "../security/appUnlock";
import type { AuthScreenProps } from "../../../navigation/types";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

/**
 * Step 2 of the magic-link sign-in. We accept the 6-digit code the backend
 * just emailed (paste support + per-cell input). When the code verifies,
 * we exchange the response tokens for an active session.
 */
export function MagicLinkVerifyScreen({
  navigation,
  route,
}: AuthScreenProps<"MagicLinkVerify">) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const { completeSessionFromTokens } = useAuth();
  const { showLoader, hideLoader } = useLoader();
  const inputs = useRef<Array<TextInput | null>>([]);
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length: CODE_LENGTH }, () => "")
  );
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  const email = route.params.email;

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      showLoader(t("auth.signingIn"));
      const tokens = await postMagicLinkVerify({ email, code });
      await completeSessionFromTokens(tokens);
      await setLastAuthMethod("magic-link");
      await promptEnableAppUnlock();
    },
    onError: (err) => {
      Alert.alert(
        t("auth.magicLink.verifyFailedTitle"),
        getApiErrorMessage(err, t("auth.magicLink.verifyFailedBody"))
      );
    },
    onSettled: () => hideLoader(),
  });

  const resendMutation = useMutation({
    mutationFn: () => postMagicLinkRequest(email),
    onSuccess: () => {
      setCooldown(RESEND_COOLDOWN_S);
      setDigits(Array.from({ length: CODE_LENGTH }, () => ""));
      inputs.current[0]?.focus();
    },
    onError: (err) => {
      Alert.alert(
        t("auth.magicLink.failedTitle"),
        getApiErrorMessage(err, t("auth.magicLink.failedBody"))
      );
    },
  });

  const submit = (code: string) => {
    if (code.length !== CODE_LENGTH) return;
    verifyMutation.mutate(code);
  };

  const setDigit = (index: number, raw: string) => {
    /** Paste support — drop a 6-char string into a single cell. */
    const clean = raw.replace(/\D/g, "");
    if (clean.length > 1) {
      const next = clean.slice(0, CODE_LENGTH).split("");
      const padded = [...next, ...Array.from({ length: CODE_LENGTH - next.length }, () => "")];
      setDigits(padded);
      const focusIdx = Math.min(next.length, CODE_LENGTH - 1);
      inputs.current[focusIdx]?.focus();
      if (next.length === CODE_LENGTH) {
        submit(padded.join(""));
      }
      return;
    }

    const updated = [...digits];
    updated[index] = clean;
    setDigits(updated);
    if (clean && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
    const joined = updated.join("");
    if (joined.length === CODE_LENGTH && !updated.includes("")) {
      submit(joined);
    }
  };

  const handleKey = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>
  ) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <AuthModalChrome>
      <AuthScreenLayout
        title={t("auth.magicLink.verifyTitle")}
        subtitle={t("auth.magicLink.verifySubtitle", { email })}
      >
        <View style={styles.codeRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                inputs.current[i] = r;
              }}
              value={digit}
              onChangeText={(text) => setDigit(i, text)}
              onKeyPress={(e) => handleKey(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              importantForAutofill="yes"
              style={[
                styles.codeCell,
                {
                  color: c.text,
                  borderColor: digit ? c.brandAccent : c.border,
                  backgroundColor: c.surfaceElevated,
                },
              ]}
              selectionColor={c.brandAccent}
              accessibilityLabel={t("auth.magicLink.cellA11y", { index: i + 1 })}
            />
          ))}
        </View>

        <Button
          label={t("auth.magicLink.verifyCta")}
          leftIcon="checkmark-circle-outline"
          loading={verifyMutation.isPending}
          disabled={digits.join("").length !== CODE_LENGTH}
          onPress={() => submit(digits.join(""))}
          size="lg"
        />

        <Pressable
          onPress={() => cooldown === 0 && resendMutation.mutate()}
          style={styles.resendWrap}
          disabled={cooldown > 0 || resendMutation.isPending}
          accessibilityRole="button"
        >
          <Ionicons
            name="refresh-outline"
            size={16}
            color={cooldown === 0 ? c.brandAccent : c.textMuted}
          />
          <Text
            style={[
              styles.resendText,
              { color: cooldown === 0 ? c.brandAccent : c.textMuted },
            ]}
          >
            {cooldown === 0
              ? t("auth.magicLink.resendCta")
              : t("auth.magicLink.resendIn", { seconds: cooldown })}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.replace("MagicLinkRequest")}
          style={styles.changeEmailWrap}
          accessibilityRole="link"
        >
          <Text style={[styles.changeEmailText, { color: c.textMuted }]}>
            {t("auth.magicLink.useDifferentEmail")}
          </Text>
        </Pressable>

        <View style={[styles.hintCard, { backgroundColor: c.surfaceElevated, borderColor: c.borderSubtle }]}>
          <Ionicons name="information-circle-outline" size={16} color={c.textMuted} />
          <Text style={[styles.hintText, { color: c.textMuted }]}>
            {t("auth.magicLink.checkSpamHint")}
          </Text>
        </View>
      </AuthScreenLayout>
    </AuthModalChrome>
  );
}

const styles = StyleSheet.create({
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: space.lg,
  },
  codeCell: {
    width: 48,
    height: 56,
    borderRadius: 10,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
  },
  resendWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: space.md,
    paddingVertical: 8,
  },
  resendText: { fontSize: 14, fontWeight: "600" },
  changeEmailWrap: { alignItems: "center", paddingVertical: 4 },
  changeEmailText: { fontSize: 13, fontWeight: "500" },
  hintCard: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    padding: space.sm,
    marginTop: space.lg,
  },
  hintText: { ...typography.caption, flex: 1, lineHeight: 18 },
});
