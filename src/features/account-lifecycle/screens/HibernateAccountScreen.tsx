/**
 * Account hibernation (Phase 2 item 16).
 *
 * Lets the user pause their account for a while:
 *   1. Pick channel → backend sends an OTP.
 *   2. Enter OTP + optional reason → backend flips `hibernated_at` and
 *      revokes every session. The user falls back to the auth flow and
 *      can come back via the WakeUpScreen's email / SMS OTP.
 *
 * Unlike deletion this is fully reversible from the auth side; nothing
 * about the user data is scrambled.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
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
  confirmHibernateOtp,
  startHibernate,
  type DeletionOtpStartResult,
} from "../../auth/api/accountDeletionApi";
import { haptics } from "../../../lib/haptics";

export function HibernateAccountScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { signOut } = useAuth();

  const styles = useThemedStyles((p) =>
    StyleSheet.create({
      infoCard: {
        flexDirection: "row",
        gap: space.sm,
        padding: space.md,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: p.borderSubtle,
        backgroundColor: p.brandAccentSubtle,
      },
      infoText: { ...typography.bodySm, color: p.brandAccent, flex: 1 },
      heading: { ...typography.titleMd, color: p.text },
      paragraph: { ...typography.bodyMd, color: p.textSecondary, marginTop: space.xs },
      bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
      bulletText: { ...typography.bodyMd, color: p.textSecondary, flex: 1 },
      channelRow: { flexDirection: "row", gap: 8 },
      channelPill: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: p.border,
      },
      channelPillActive: {
        borderColor: p.brandAccent,
        backgroundColor: p.brandAccentSubtle,
      },
      channelPillText: { color: p.textSecondary },
      channelPillTextActive: { color: p.brandAccent, fontWeight: "700" },
      maskedTarget: { color: p.brandAccent, fontWeight: "700" },
    })
  );

  const [stage, setStage] = useState<"intro" | "otp">("intro");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [reason, setReason] = useState("");
  const [otp, setOtp] = useState<DeletionOtpStartResult | null>(null);
  const [code, setCode] = useState("");

  const startMutation = useMutation({
    mutationFn: () => startHibernate(channel),
    onSuccess: (info) => {
      haptics.success?.();
      setOtp(info);
      setStage("otp");
    },
    onError: (err) => {
      Alert.alert(
        t("hibernate.errorTitle", { defaultValue: "Couldn't send code" }),
        getApiErrorMessage(err)
      );
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmHibernateOtp({
        code: code.trim(),
        reason: reason.trim() || undefined,
      }),
    onSuccess: async () => {
      haptics.success?.();
      Alert.alert(
        t("hibernate.successTitle", { defaultValue: "Account paused" }),
        t("hibernate.successBody", {
          defaultValue:
            "Your account is paused. Sign in any time with a wake-up code to come back.",
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
        t("hibernate.errorTitle", { defaultValue: "Couldn't pause account" }),
        getApiErrorMessage(err)
      );
    },
  });

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingTop: space.md,
          gap: space.md,
          paddingBottom: space.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader label={t("hibernate.title", { defaultValue: "Pause my account" })} />

        <View style={styles.infoCard}>
          <Ionicons name="moon-outline" size={20} color={c.brandAccent} />
          <Text style={styles.infoText}>
            {t("hibernate.intro", {
              defaultValue:
                "Hibernating hides your profile from search, pauses bookings and messages, and signs you out. Nothing is deleted — come back any time.",
            })}
          </Text>
        </View>

        {stage === "intro" ? (
          <>
            <Card style={{ padding: space.md, gap: space.sm }}>
              <Text style={styles.heading}>
                {t("hibernate.whatHappens", { defaultValue: "While you're paused" })}
              </Text>
              {[
                t("hibernate.point1", {
                  defaultValue: "You won't appear in trainer / trainee search.",
                }),
                t("hibernate.point2", {
                  defaultValue: "New booking and message requests are blocked.",
                }),
                t("hibernate.point3", {
                  defaultValue: "Your clips, wallet, and history stay intact.",
                }),
                t("hibernate.point4", {
                  defaultValue: "Sign back in with a one-time wake-up code.",
                }),
              ].map((text, i) => (
                <View key={`pt-${i}`} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={c.brandAccent} />
                  <Text style={styles.bulletText}>{text}</Text>
                </View>
              ))}
            </Card>

            <Card style={{ padding: space.md, gap: space.sm }}>
              <Text style={styles.heading}>
                {t("hibernate.channelTitle", {
                  defaultValue: "Where should we send the code?",
                })}
              </Text>
              <View style={styles.channelRow}>
                {(["email", "sms"] as const).map((ch) => {
                  const active = channel === ch;

                  return (
                    <Pressable
                      key={ch}
                      style={[styles.channelPill, active && styles.channelPillActive]}
                      onPress={() => setChannel(ch)}
                    >
                      <Text
                        style={[
                          styles.channelPillText,
                          active && styles.channelPillTextActive,
                        ]}
                      >
                        {ch === "email" ? "Email" : "SMS"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <FormField
                label={t("hibernate.reasonLabel", {
                  defaultValue: "Reason (optional)",
                })}
                value={reason}
                onChangeText={setReason}
                multiline
              />
            </Card>

            <Button
              variant="primary"
              onPress={() => startMutation.mutate()}
              loading={startMutation.isPending}
              label={t("hibernate.sendCode", { defaultValue: "Send confirmation code" })}
            />
          </>
        ) : (
          <Card style={{ padding: space.md, gap: space.sm }}>
            <Text style={styles.heading}>
              {t("hibernate.enterCode", { defaultValue: "Enter the 6-digit code" })}
            </Text>
            {otp?.target ? (
              <Text style={{ ...typography.bodySm, color: c.textSecondary }}>
                {t("hibernate.codeSentTo", { defaultValue: "We sent it to" })}{" "}
                <Text style={styles.maskedTarget}>{otp.target}</Text>
              </Text>
            ) : null}
            <FormField
              label={t("hibernate.codeLabel", { defaultValue: "Verification code" })}
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              required
            />
            <Button
              variant="primary"
              onPress={() => confirmMutation.mutate()}
              loading={confirmMutation.isPending}
              disabled={!code.trim()}
              label={t("hibernate.confirm", { defaultValue: "Pause account" })}
            />
            <Button
              variant="ghost"
              onPress={() => setStage("intro")}
              label={t("common.back", { defaultValue: "Back" })}
            />
          </Card>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
