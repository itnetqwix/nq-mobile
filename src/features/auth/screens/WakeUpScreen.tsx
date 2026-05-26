import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, FormField, Stack } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { AuthModalChrome } from "../components/AuthModalChrome";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import type { AuthScreenProps } from "../../../navigation/types";

/**
 * Hibernation wake-up flow (Phase 2 item 16).
 *
 * Step 1 — user enters their email or phone; we POST to
 *   `/auth/wake-up/start` (no auth needed) and the backend either sends
 *   an OTP (account is hibernated) or returns `{ accountId: null }` to
 *   avoid leaking account state.
 *
 * Step 2 — user enters the OTP; we POST `/auth/wake-up/confirm` with the
 *   account id received from step 1. Once it succeeds, the backend has
 *   already cleared `hibernated_at`; we bounce the user back to login.
 */
export function WakeUpScreen({ navigation, route }: AuthScreenProps<"WakeUp">) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        helper: {
          ...typography.bodySm,
          color: c.textSecondary,
          marginBottom: space.xs,
        },
        switchChannel: {
          marginTop: space.sm,
          alignItems: "center",
        },
        switchChannelText: { color: c.brandAccent, fontWeight: "600" },
        link: { color: c.brandAccent, fontSize: 14, fontWeight: "600" },
        backRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: space.md,
          paddingVertical: 8,
        },
        maskedTarget: { color: c.brandNavy, fontWeight: "700" },
      }),
    [c]
  );

  const [stage, setStage] = useState<"contact" | "otp">("contact");
  const [contact, setContact] = useState((route.params?.contact ?? "") as string);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [maskedTarget, setMaskedTarget] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const startWakeUp = useCallback(async () => {
    if (!contact.trim()) {
      Alert.alert(
        t("wakeUp.errorTitle", { defaultValue: "Couldn't send code" }),
        t("wakeUp.contactRequired", {
          defaultValue: "Enter your email or phone number first.",
        })
      );

      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.post(API_ROUTES.auth.wakeUpStart, {
        contact: contact.trim(),
        channel,
      });
      const data = res.data?.data ?? res.data;
      if (!data?.accountId) {
        Alert.alert(
          t("wakeUp.noAccountTitle", { defaultValue: "Check your inbox" }),
          t("wakeUp.noAccountBody", {
            defaultValue:
              "If a paused account matches this email or phone, we've sent you a verification code.",
          })
        );
      }
      setAccountId(data?.accountId ?? null);
      setMaskedTarget(data?.otp?.target ?? null);
      setStage("otp");
    } catch (err: any) {
      Alert.alert(
        t("wakeUp.errorTitle", { defaultValue: "Couldn't send code" }),
        err?.response?.data?.error || err?.message || "Network error"
      );
    } finally {
      setBusy(false);
    }
  }, [contact, channel, t]);

  const confirmWakeUp = useCallback(async () => {
    if (!accountId) {
      Alert.alert(
        t("wakeUp.errorTitle", { defaultValue: "Couldn't sign in" }),
        t("wakeUp.noPendingChallenge", {
          defaultValue: "Start over — we couldn't find a paused account for that contact.",
        })
      );

      return;
    }
    if (!code.trim()) return;
    setBusy(true);
    try {
      await apiClient.post(API_ROUTES.auth.wakeUpConfirm, {
        accountId,
        code: code.trim(),
      });
      Alert.alert(
        t("wakeUp.successTitle", { defaultValue: "Welcome back!" }),
        t("wakeUp.successBody", {
          defaultValue: "Your account is active again. Sign in below to continue.",
        }),
        [
          {
            text: t("common.ok", { defaultValue: "OK" }),
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        t("wakeUp.errorTitle", { defaultValue: "Couldn't sign in" }),
        err?.response?.data?.error || err?.message || "Invalid code"
      );
    } finally {
      setBusy(false);
    }
  }, [accountId, code, navigation, t]);

  // Auto-focus contact input on mount when prefilled.
  useEffect(() => {
    if (route.params?.contact && stage === "contact") {
      // The form field will already render with the value.
    }
  }, [route.params?.contact, stage]);

  return (
    <AuthModalChrome>
      <AuthScreenLayout
        title={t("wakeUp.title", { defaultValue: "Welcome back" })}
        subtitle={t("wakeUp.subtitle", {
          defaultValue:
            stage === "contact"
              ? "Enter your email or phone to receive a wake-up code."
              : `We sent a code to ${maskedTarget ?? "your inbox"}. Enter it to reactivate.`,
        })}
        footer={
          <Pressable
            onPress={() => navigation.navigate("Login")}
            style={styles.backRow}
            accessibilityRole="link"
          >
            <Ionicons name="arrow-back" size={16} color={c.brandAccent} />
            <Text style={styles.link}>
              {t("wakeUp.backToLogin", { defaultValue: "Back to sign in" })}
            </Text>
          </Pressable>
        }
      >
        <Stack gap="md">
          {stage === "contact" ? (
            <>
              <Text style={styles.helper}>
                {t("wakeUp.helper", {
                  defaultValue:
                    "Paused accounts need a quick verification to come back. We'll send a 6-digit code to your registered email or phone.",
                })}
              </Text>
              <FormField
                label={t("wakeUp.contactLabel", {
                  defaultValue: "Email or phone number",
                })}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={contact}
                onChangeText={setContact}
                required
              />
              <Button
                onPress={startWakeUp}
                loading={busy}
                disabled={busy || !contact.trim()}
                label={t("wakeUp.sendCode", { defaultValue: "Send wake-up code" })}
              />
              <Pressable
                style={styles.switchChannel}
                onPress={() => setChannel(channel === "email" ? "sms" : "email")}
              >
                <Text style={styles.switchChannelText}>
                  {channel === "email"
                    ? t("wakeUp.useSms", { defaultValue: "Use SMS instead" })
                    : t("wakeUp.useEmail", { defaultValue: "Use email instead" })}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {maskedTarget ? (
                <Text style={styles.helper}>
                  {t("wakeUp.codeSent", {
                    defaultValue: "We sent a 6-digit code to",
                  })}{" "}
                  <Text style={styles.maskedTarget}>{maskedTarget}</Text>
                </Text>
              ) : null}
              <FormField
                label={t("wakeUp.codeLabel", { defaultValue: "Verification code" })}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                required
              />
              <Button
                onPress={confirmWakeUp}
                loading={busy}
                disabled={busy || !code.trim()}
                label={t("wakeUp.confirm", { defaultValue: "Reactivate account" })}
              />
              <Pressable
                style={styles.switchChannel}
                onPress={() => setStage("contact")}
              >
                <Text style={styles.switchChannelText}>
                  {t("wakeUp.changeContact", {
                    defaultValue: "Wrong email or phone? Start over",
                  })}
                </Text>
              </Pressable>
            </>
          )}
        </Stack>
      </AuthScreenLayout>
    </AuthModalChrome>
  );
}
