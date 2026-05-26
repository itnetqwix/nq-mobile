/**
 * Account deletion (Phase 2 item 15).
 *
 * Two-step flow:
 *   1. Re-enter password + (optional) reason → backend sends a 6-digit code
 *      to the user's email / phone.
 *   2. Enter the code → backend marks the account `pending_deletion_at`
 *      and opens a 15-day support-restore window. We sign out locally.
 *
 * The legacy one-tap delete is hidden behind `cancelPendingDeletion()` —
 * which the UI offers if the user reopens this screen while still inside
 * the 15-day window.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  FormField,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import {
  cancelPendingDeletion,
  confirmAccountDeletionOtp,
  getLifecycleState,
  startAccountDeletion,
  type DeletionOtpStartResult,
} from "../../auth/api/accountDeletionApi";
import { haptics } from "../../../lib/haptics";

const LIFECYCLE_KEY = ["account-lifecycle", "state"] as const;

const REASON_OPTIONS = [
  { id: "found_alternative", label: "Found a different app" },
  { id: "too_expensive", label: "It's too expensive" },
  { id: "privacy", label: "Privacy concerns" },
  { id: "bug", label: "App has too many bugs" },
  { id: "support", label: "Couldn't get help when I needed it" },
  { id: "other", label: "Other" },
];

export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { signOut } = useAuth();

  const styles = useThemedStyles((p) =>
    StyleSheet.create({
      heading: { ...typography.titleMd, color: p.text },
      paragraph: {
        ...typography.bodyMd,
        color: p.textSecondary,
        marginTop: space.xs,
      },
      warningCard: {
        flexDirection: "row",
        gap: space.sm,
        padding: space.md,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#f3c5c0",
        backgroundColor: "#fdecea",
      },
      warningText: { ...typography.bodySm, color: "#8a1c12", flex: 1 },
      reasonRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
      },
      reasonPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: p.border,
        backgroundColor: p.surface,
      },
      reasonPillActive: {
        borderColor: p.brandAccent,
        backgroundColor: p.brandAccentSubtle,
      },
      reasonPillText: { ...typography.bodySm, color: p.textSecondary },
      reasonPillTextActive: { color: p.brandAccent, fontWeight: "700" },
      maskedTarget: { color: p.brandAccent, fontWeight: "700" },
      stepHelper: {
        ...typography.bodySm,
        color: p.textSecondary,
        marginBottom: space.xs,
      },
      restoreCard: {
        padding: space.md,
        gap: space.sm,
      },
    })
  );

  const [stage, setStage] = useState<"intro" | "otp">("intro");
  const [password, setPassword] = useState("");
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [otp, setOtp] = useState<DeletionOtpStartResult | null>(null);
  const [code, setCode] = useState("");

  const lifecycle = useQuery({
    queryKey: LIFECYCLE_KEY,
    queryFn: getLifecycleState,
    staleTime: 30_000,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!password) {
        throw new Error("password");
      }
      const reasonText =
        reasonId === "other"
          ? otherReason.trim() || "Other"
          : REASON_OPTIONS.find((r) => r.id === reasonId)?.label;

      return startAccountDeletion({
        password,
        reason: reasonText,
        feedback_category: reasonId ?? undefined,
        channel,
      });
    },
    onSuccess: (info) => {
      setOtp(info);
      setStage("otp");
      haptics.success?.();
    },
    onError: (err) => {
      if ((err as Error).message === "password") {
        Alert.alert(
          t("deleteAccount.passwordRequiredTitle", { defaultValue: "Enter your password" }),
          t("deleteAccount.passwordRequiredBody", {
            defaultValue: "Type your current password to confirm the deletion request.",
          })
        );

        return;
      }
      Alert.alert(
        t("deleteAccount.errorTitle", { defaultValue: "Couldn't send code" }),
        getApiErrorMessage(err)
      );
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!code.trim()) throw new Error("code");
      const reasonText =
        reasonId === "other"
          ? otherReason.trim() || "Other"
          : REASON_OPTIONS.find((r) => r.id === reasonId)?.label;

      return confirmAccountDeletionOtp({ code: code.trim(), reason: reasonText });
    },
    onSuccess: async (info) => {
      haptics.success?.();
      Alert.alert(
        t("deleteAccount.successTitle", { defaultValue: "Account scheduled" }),
        t("deleteAccount.successBody", {
          defaultValue:
            "We've scheduled your account for deletion. Support can restore it for the next 15 days — after that everything is permanently removed.",
          days: info.restoreWindowDays ?? 15,
        }),
        [
          {
            text: t("common.ok", { defaultValue: "OK" }),
            onPress: () => {
              void signOut();
            },
          },
        ]
      );
    },
    onError: (err) => {
      Alert.alert(
        t("deleteAccount.errorTitle", { defaultValue: "Couldn't confirm" }),
        getApiErrorMessage(err)
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPendingDeletion,
    onSuccess: () => {
      haptics.success?.();
      lifecycle.refetch();
      Alert.alert(
        t("deleteAccount.cancelledTitle", { defaultValue: "Restored" }),
        t("deleteAccount.cancelledBody", {
          defaultValue: "Your account is no longer scheduled for deletion.",
        })
      );
    },
    onError: (err) => {
      Alert.alert(
        t("deleteAccount.errorTitle", { defaultValue: "Couldn't restore" }),
        getApiErrorMessage(err)
      );
    },
  });

  const restoreDeadlineDate = useMemo(() => {
    const raw = lifecycle.data?.restoreDeadline;

    return raw ? new Date(raw) : null;
  }, [lifecycle.data?.restoreDeadline]);

  if (lifecycle.data?.pendingDeletion) {
    // Already deleted — offer to cancel the restore window.
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md, gap: space.md }}>
          <SectionHeader label={t("deleteAccount.pendingTitle", { defaultValue: "Account scheduled for deletion" })} />
          <Card style={styles.restoreCard}>
            <Text style={styles.heading}>
              {t("deleteAccount.pendingHeading", {
                defaultValue: "We'll permanently delete your account on:",
              })}
            </Text>
            <Text style={[typography.titleSm, { color: c.brandAccent }]}>
              {restoreDeadlineDate ? restoreDeadlineDate.toLocaleString() : "—"}
            </Text>
            <Text style={styles.paragraph}>
              {t("deleteAccount.pendingBody", {
                defaultValue:
                  "You can sign in any time before then to restore your account, or contact support for help.",
              })}
            </Text>
            <Button
              variant="primary"
              onPress={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
              label={t("deleteAccount.cancelDeletion", { defaultValue: "Cancel deletion" })}
            />
          </Card>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md, gap: space.md, paddingBottom: space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader label={t("deleteAccount.title", { defaultValue: "Delete account" })} />

        <View style={styles.warningCard}>
          <Ionicons name="alert-circle" size={20} color="#8a1c12" />
          <Text style={styles.warningText}>
            {t("deleteAccount.warningBody", {
              defaultValue:
                "Deleting your account will remove you from sessions, payments, and messaging. Support can restore your account for up to 15 days. After that everything is gone.",
            })}
          </Text>
        </View>

        {stage === "intro" ? (
          <>
            <Card style={{ padding: space.md, gap: space.sm }}>
              <Text style={styles.heading}>
                {t("deleteAccount.confirmPasswordTitle", {
                  defaultValue: "Confirm with your password",
                })}
              </Text>
              <Text style={styles.paragraph}>
                {t("deleteAccount.confirmPasswordBody", {
                  defaultValue:
                    "Type your current sign-in password. This protects your account if your device was lost or stolen.",
                })}
              </Text>
              <FormField
                label={t("auth.password", { defaultValue: "Password" })}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
                required
              />
            </Card>

            <Card style={{ padding: space.md, gap: space.sm }}>
              <Text style={styles.heading}>
                {t("deleteAccount.reasonTitle", {
                  defaultValue: "Tell us why (optional)",
                })}
              </Text>
              <View style={styles.reasonRow}>
                {REASON_OPTIONS.map((opt) => {
                  const active = reasonId === opt.id;

                  return (
                    <Pressable
                      key={opt.id}
                      style={[styles.reasonPill, active && styles.reasonPillActive]}
                      onPress={() => setReasonId(active ? null : opt.id)}
                    >
                      <Text
                        style={[
                          styles.reasonPillText,
                          active && styles.reasonPillTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {reasonId === "other" ? (
                <FormField
                  label={t("deleteAccount.otherReasonLabel", {
                    defaultValue: "Tell us more",
                  })}
                  value={otherReason}
                  onChangeText={setOtherReason}
                  multiline
                />
              ) : null}
            </Card>

            <Card style={{ padding: space.md, gap: space.sm }}>
              <Text style={styles.heading}>
                {t("deleteAccount.channelTitle", { defaultValue: "Where should we send the code?" })}
              </Text>
              <View style={styles.reasonRow}>
                {(["email", "sms"] as const).map((ch) => {
                  const active = channel === ch;

                  return (
                    <Pressable
                      key={ch}
                      style={[styles.reasonPill, active && styles.reasonPillActive]}
                      onPress={() => setChannel(ch)}
                    >
                      <Text
                        style={[
                          styles.reasonPillText,
                          active && styles.reasonPillTextActive,
                        ]}
                      >
                        {ch === "email" ? "Email" : "SMS"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Button
              variant="danger"
              onPress={() => startMutation.mutate()}
              loading={startMutation.isPending}
              label={t("deleteAccount.sendCode", { defaultValue: "Send verification code" })}
            />
          </>
        ) : (
          <>
            <Card style={{ padding: space.md, gap: space.sm }}>
              <Text style={styles.heading}>
                {t("deleteAccount.enterCodeTitle", {
                  defaultValue: "Enter the 6-digit code",
                })}
              </Text>
              {otp?.target ? (
                <Text style={styles.stepHelper}>
                  {t("deleteAccount.codeSentTo", { defaultValue: "We sent it to" })}{" "}
                  <Text style={styles.maskedTarget}>{otp.target}</Text>
                </Text>
              ) : null}
              <FormField
                label={t("deleteAccount.codeLabel", { defaultValue: "Verification code" })}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                required
              />
              <Button
                variant="danger"
                onPress={() => confirmMutation.mutate()}
                loading={confirmMutation.isPending}
                disabled={!code.trim()}
                label={t("deleteAccount.confirmDelete", {
                  defaultValue: "Delete my account",
                })}
              />
              <Button
                variant="ghost"
                onPress={() => setStage("intro")}
                label={t("common.back", { defaultValue: "Back" })}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
