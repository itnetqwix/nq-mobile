/**
 * TwoFactorScreen — extra OTP layer for trainer accounts.
 *
 * Flow:
 *   1. Trainer picks the delivery method (email / SMS).
 *   2. Backend dispatches a one-time code; we surface a 6-digit input.
 *   3. On success 2FA is enabled and (optionally) this device is remembered
 *      so the trainer doesn't have to OTP every launch — only on new
 *      devices or after revoking the trust.
 *   4. Trusted devices are listed below with revoke buttons.
 *
 * The screen is only registered for `AccountType.TRAINER` from settings,
 * but renders harmlessly for trainees if linked directly.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  EmptyState,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import {
  disableTwoFactor,
  fetchTrustedDevices,
  fetchTwoFactorStatus,
  requestTwoFactorChallenge,
  revokeTrustedDevice,
  verifyTwoFactorChallenge,
  type TrustedDevice,
  type TwoFactorStatus,
} from "../api/privacyApi";

const STATUS_KEY = ["settings", "twoFactor", "status"] as const;
const DEVICES_KEY = ["settings", "twoFactor", "devices"] as const;

type Method = "email" | "sms";

export function TwoFactorScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const qc = useQueryClient();

  const styles = useThemedStyles((p) =>
    StyleSheet.create({
      methodCard: {
        padding: space.md,
        gap: space.sm,
      },
      methodRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: space.sm,
      },
      methodPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: p.border,
      },
      methodPillActive: {
        backgroundColor: p.brandAccentSubtle,
        borderColor: p.brandAccent,
      },
      otpInput: {
        ...typography.titleLg,
        color: p.text,
        textAlign: "center",
        letterSpacing: 8,
        backgroundColor: p.input,
        borderColor: p.inputBorder,
        borderWidth: 1,
        borderRadius: radii.md,
        paddingVertical: 14,
        paddingHorizontal: space.md,
        marginTop: space.sm,
      },
      deviceRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
      },
      revokeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: p.border,
        backgroundColor: p.surfaceElevated,
      },
    })
  );

  const statusQ = useQuery({
    queryKey: STATUS_KEY,
    queryFn: fetchTwoFactorStatus,
    staleTime: 30_000,
  });

  const devicesQ = useQuery({
    queryKey: DEVICES_KEY,
    queryFn: fetchTrustedDevices,
    enabled: !!statusQ.data?.enabled,
    staleTime: 30_000,
  });

  const status: TwoFactorStatus = statusQ.data ?? { enabled: false };

  const [method, setMethod] = useState<Method>("email");
  const [challengeTarget, setChallengeTarget] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);

  const challengeMut = useMutation({
    mutationFn: (m: Method) => requestTwoFactorChallenge(m),
    onSuccess: (r) => setChallengeTarget(r.target || method),
    onError: (e) =>
      Alert.alert(t("twoFactor.challengeErrorTitle", { defaultValue: "Couldn't send code" }), getApiErrorMessage(e)),
  });

  const verifyMut = useMutation({
    mutationFn: (codeStr: string) => verifyTwoFactorChallenge(codeStr, rememberDevice),
    onSuccess: () => {
      setCode("");
      setChallengeTarget(null);
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
      void qc.invalidateQueries({ queryKey: DEVICES_KEY });
      Alert.alert(
        t("twoFactor.enabledTitle", { defaultValue: "Two-factor enabled" }),
        t("twoFactor.enabledBody", {
          defaultValue: "We'll ask for a code the next time you sign in on a new device.",
        })
      );
    },
    onError: (e) =>
      Alert.alert(
        t("twoFactor.verifyErrorTitle", { defaultValue: "Code didn't match" }),
        getApiErrorMessage(e, t("twoFactor.verifyErrorBody", { defaultValue: "Double-check the code and try again." }))
      ),
  });

  const disableMut = useMutation({
    mutationFn: disableTwoFactor,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
      void qc.invalidateQueries({ queryKey: DEVICES_KEY });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeTrustedDevice(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: DEVICES_KEY }),
  });

  const handleStartEnrolment = useCallback(() => {
    setCode("");
    challengeMut.mutate(method);
  }, [challengeMut, method]);

  const handleSubmitCode = useCallback(() => {
    if (code.trim().length < 6) {
      Alert.alert(
        t("twoFactor.codeShortTitle", { defaultValue: "Enter all 6 digits" }),
        t("twoFactor.codeShortBody", { defaultValue: "The verification code is six digits long." })
      );
      return;
    }
    verifyMut.mutate(code.trim());
  }, [code, t, verifyMut]);

  const handleDisable = useCallback(() => {
    Alert.alert(
      t("twoFactor.disableConfirmTitle", { defaultValue: "Turn off two-factor?" }),
      t("twoFactor.disableConfirmBody", {
        defaultValue:
          "Your account will rely on password / biometric login alone. You can turn it back on at any time.",
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("twoFactor.disableConfirm", { defaultValue: "Turn off" }),
          style: "destructive",
          onPress: () => disableMut.mutate(),
        },
      ]
    );
  }, [disableMut, t]);

  const handleRevokeDevice = useCallback(
    (d: TrustedDevice) => {
      Alert.alert(
        t("twoFactor.revokeConfirmTitle", { defaultValue: "Revoke {{label}}?", label: d.label }),
        t("twoFactor.revokeConfirmBody", {
          defaultValue: "Sign-ins from this device will need to enter a code again.",
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("twoFactor.revoke", { defaultValue: "Revoke" }),
            style: "destructive",
            onPress: () => revokeMut.mutate(d.id),
          },
        ]
      );
    },
    [revokeMut, t]
  );

  const enabledBlock = useMemo(() => {
    if (!status.enabled) return null;
    const last = status.lastVerifiedAt
      ? new Date(status.lastVerifiedAt).toLocaleString()
      : null;
    return (
      <Card variant="outlined" padding="md" style={{ marginBottom: space.md, gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: c.successSubtle,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="shield-checkmark" size={20} color={c.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.titleSm, { color: c.text }]}>
              {t("twoFactor.activeTitle", { defaultValue: "Two-factor authentication is active" })}
            </Text>
            <Text style={[typography.caption, { color: c.textMuted }]}>
              {t("twoFactor.activeMethod", {
                defaultValue: "Method: {{method}}",
                method: status.method?.toUpperCase() ?? "EMAIL",
              })}
            </Text>
          </View>
        </View>
        {last ? (
          <Text style={[typography.caption, { color: c.textMuted }]}>
            {t("twoFactor.lastVerified", { defaultValue: "Last verified {{when}}", when: last })}
          </Text>
        ) : null}
        <Button
          label={t("twoFactor.disable", { defaultValue: "Turn off two-factor" })}
          variant="ghost"
          onPress={handleDisable}
          loading={disableMut.isPending}
        />
      </Card>
    );
  }, [status, c, t, handleDisable, disableMut.isPending]);

  return (
    <ScreenContainer scroll padding="md" background={c.surface}>
      <SectionHeader label={t("twoFactor.title", { defaultValue: "Two-factor authentication" })} />

      <Card variant="outlined" padding="md" style={{ marginBottom: space.md }}>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Ionicons name="lock-closed-outline" size={20} color={c.iconPrimary} />
          <Text style={[typography.bodySm, { color: c.textSecondary, flex: 1 }]}>
            {t("twoFactor.intro", {
              defaultValue:
                "Add an extra OTP step for trainer accounts so a leaked password alone can't unlock your business profile and payouts.",
            })}
          </Text>
        </View>
      </Card>

      {statusQ.isLoading ? (
        <ActivityIndicator color={c.brandAccent} style={{ marginVertical: space.lg }} />
      ) : status.enabled ? (
        enabledBlock
      ) : (
        <Card variant="outlined" padding={0} style={styles.methodCard}>
          <Text style={[typography.subtitle, { color: c.text }]}>
            {t("twoFactor.chooseMethod", { defaultValue: "Choose how to receive codes" })}
          </Text>

          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
            {(["email", "sms"] as const).map((m) => {
              const active = method === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityLabel={
                    m === "email"
                      ? t("twoFactor.methodEmailA11y", { defaultValue: "Receive codes by email" })
                      : t("twoFactor.methodSmsA11y", { defaultValue: "Receive codes by SMS" })
                  }
                  onPress={() => setMethod(m)}
                  style={[styles.methodPill, active && styles.methodPillActive]}
                >
                  <Ionicons
                    name={m === "email" ? "mail-outline" : "chatbubble-outline"}
                    size={16}
                    color={active ? c.brandAccent : c.textMuted}
                  />
                  <Text
                    style={[
                      typography.label,
                      { color: active ? c.brandAccent : c.textSecondary },
                    ]}
                  >
                    {m === "email" ? t("twoFactor.email", { defaultValue: "Email" }) : t("twoFactor.sms", { defaultValue: "SMS" })}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {challengeTarget ? (
            <>
              <Text style={[typography.bodySm, { color: c.textSecondary, marginTop: space.sm }]}>
                {t("twoFactor.codeSent", {
                  defaultValue: "We sent a 6-digit code to {{target}}",
                  target: challengeTarget,
                })}
              </Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                placeholderTextColor={c.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                accessibilityLabel={t("twoFactor.codeInputA11y", {
                  defaultValue: "6-digit verification code",
                })}
                style={styles.otpInput}
              />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  marginTop: space.sm,
                }}
              >
                <Switch
                  value={rememberDevice}
                  onValueChange={setRememberDevice}
                  trackColor={{ false: c.neutral200, true: c.brandAccentSubtle }}
                  thumbColor={rememberDevice ? c.brandAccent : c.neutral100}
                  accessibilityLabel={t("twoFactor.trustDeviceA11y", {
                    defaultValue: "Remember this device for 30 days",
                  })}
                />
                <Text style={[typography.bodySm, { color: c.textSecondary, flex: 1 }]}>
                  {t("twoFactor.trustDevice", {
                    defaultValue:
                      "Trust this device for 30 days. New devices will still need a fresh code.",
                  })}
                </Text>
              </View>
              <Button
                label={t("twoFactor.verify", { defaultValue: "Verify code" })}
                onPress={handleSubmitCode}
                loading={verifyMut.isPending}
                style={{ marginTop: space.sm }}
              />
              <Button
                label={t("twoFactor.resend", { defaultValue: "Resend code" })}
                variant="ghost"
                onPress={handleStartEnrolment}
                loading={challengeMut.isPending}
              />
            </>
          ) : (
            <Button
              label={t("twoFactor.sendCode", { defaultValue: "Send me a code" })}
              onPress={handleStartEnrolment}
              loading={challengeMut.isPending}
              leftIcon="paper-plane-outline"
              style={{ marginTop: space.sm }}
            />
          )}
        </Card>
      )}

      {status.enabled ? (
        <>
          <SectionHeader label={t("twoFactor.trustedDevices", { defaultValue: "Trusted devices" })} />
          <Card variant="outlined" padding={0}>
            {devicesQ.isLoading ? (
              <View style={{ padding: space.md, alignItems: "center" }}>
                <ActivityIndicator color={c.brandAccent} />
              </View>
            ) : (devicesQ.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon="phone-portrait-outline"
                title={t("twoFactor.noDevicesTitle", { defaultValue: "No trusted devices yet" })}
                description={t("twoFactor.noDevicesBody", {
                  defaultValue:
                    "Devices you tick \"remember\" on during sign-in show up here so you can revoke them anytime.",
                })}
              />
            ) : (
              (devicesQ.data ?? []).map((d, idx) => (
                <React.Fragment key={d.id}>
                  {idx > 0 ? (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: c.border,
                        marginLeft: space.md,
                      }}
                    />
                  ) : null}
                  <View style={styles.deviceRow}>
                    <Ionicons
                      name={d.current ? "phone-portrait" : "laptop-outline"}
                      size={22}
                      color={c.iconPrimary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.subtitle, { color: c.text }]}>
                        {d.label}
                        {d.current ? (
                          <Text style={[typography.caption, { color: c.brandAccent }]}>
                            {"  "}
                            {t("twoFactor.thisDevice", { defaultValue: "(this device)" })}
                          </Text>
                        ) : null}
                      </Text>
                      <Text style={[typography.caption, { color: c.textMuted }]}>
                        {[d.location, d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleRevokeDevice(d)}
                      disabled={d.current || revokeMut.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={t("twoFactor.revokeA11y", {
                        defaultValue: "Revoke trust for {{label}}",
                        label: d.label,
                      })}
                      style={[styles.revokeBtn, d.current && { opacity: 0.5 }]}
                    >
                      <Text style={[typography.label, { color: c.text }]}>
                        {t("twoFactor.revoke", { defaultValue: "Revoke" })}
                      </Text>
                    </Pressable>
                  </View>
                </React.Fragment>
              ))
            )}
          </Card>
        </>
      ) : null}

      <View style={{ height: space.xl }} />
    </ScreenContainer>
  );
}
