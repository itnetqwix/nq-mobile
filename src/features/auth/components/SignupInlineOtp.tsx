import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button, FormField } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { checkSignupContact, sendSignupOtp, verifySignupOtp } from "../api/signupOtpApi";

const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_CHECK_DEBOUNCE_MS = 450;

type Props = {
  channel: "email" | "sms";
  email?: string;
  mobile?: string;
  disabled?: boolean;
  verified: boolean;
  onVerified: () => void;
  onResetVerified?: () => void;
};

type ContactGate = "idle" | "checking" | "available" | "unavailable";

export function SignupInlineOtp({
  channel,
  email,
  mobile,
  disabled,
  verified,
  onVerified,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactGate, setContactGate] = useState<ContactGate>("idle");
  const [contactMessage, setContactMessage] = useState<string | null>(null);

  const destination = channel === "email" ? email?.trim() : mobile?.trim();
  const formatValid =
    channel === "email"
      ? Boolean(destination && EMAIL_RE.test(destination))
      : Boolean(destination && destination.replace(/\D/g, "").length >= 10);

  const canSendOtp =
    !disabled &&
    !verified &&
    formatValid &&
    contactGate === "available";

  useEffect(() => {
    setSent(false);
    setCode("");
    setError(null);
    setCooldown(0);
    setContactGate("idle");
    setContactMessage(null);
  }, [destination, channel]);

  useEffect(() => {
    if (disabled || verified || !destination) {
      setContactGate("idle");
      setContactMessage(null);
      return;
    }
    if (!formatValid) {
      setContactGate("idle");
      setContactMessage(
        channel === "email" ? t("auth.enterValidEmailForOtp") : t("auth.enterValidPhoneForOtp")
      );
      return;
    }

    let cancelled = false;
    setContactGate("checking");
    setContactMessage(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await checkSignupContact(channel, {
            email: channel === "email" ? destination : undefined,
            mobile_no: channel === "sms" ? destination : undefined,
          });
          if (cancelled) return;
          if (result.available) {
            setContactGate("available");
            setContactMessage(null);
          } else {
            setContactGate("unavailable");
            setContactMessage(
              result.message ||
                (channel === "email"
                  ? t("auth.emailAlreadyRegistered")
                  : t("auth.phoneAlreadyRegistered"))
            );
          }
        } catch (e) {
          if (cancelled) return;
          setContactGate("unavailable");
          setContactMessage(getApiErrorMessage(e));
        }
      })();
    }, CONTACT_CHECK_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    channel,
    destination,
    disabled,
    formatValid,
    verified,
    t,
  ]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const tick = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(tick);
  }, [cooldown]);

  const sendCode = useCallback(async () => {
    if (!destination || !canSendOtp) return;
    setError(null);
    setLoading(true);
    try {
      await sendSignupOtp(channel, {
        email: channel === "email" ? destination : undefined,
        mobile_no: channel === "sms" ? destination : undefined,
      });
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      setError(getApiErrorMessage(e, t("auth.otpSendFailed")));
    } finally {
      setLoading(false);
    }
  }, [canSendOtp, channel, destination, t]);

  const verify = useCallback(async () => {
    if (!destination || code.trim().length < 6) {
      setError(t("auth.enterSixDigitCode"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifySignupOtp(
        channel,
        {
          email: channel === "email" ? destination : undefined,
          mobile_no: channel === "sms" ? destination : undefined,
        },
        code.trim()
      );
      onVerified();
    } catch (e) {
      setError(getApiErrorMessage(e, t("auth.otpVerifyFailed")));
    } finally {
      setLoading(false);
    }
  }, [channel, code, destination, onVerified, t]);

  if (verified) {
    return (
      <View style={[styles.verifiedRow, { backgroundColor: c.brandSubtle, borderColor: c.success }]}>
        <Ionicons name="checkmark-circle" size={20} color={c.success} />
        <Text style={[styles.verifiedText, { color: c.success }]}>
          {channel === "email" ? t("auth.emailVerified") : t("auth.phoneVerified")}
        </Text>
      </View>
    );
  }

  if (disabled) {
    return (
      <Text style={[styles.hint, { color: c.textMuted }]}>
        {channel === "sms" ? t("auth.verifyEmailBeforePhone") : t("auth.enterValidEmailForOtp")}
      </Text>
    );
  }

  const showSendButton = !sent && canSendOtp;
  const showStatusLine =
    !sent &&
    (contactGate === "checking" ||
      contactMessage ||
      (formatValid && contactGate === "available"));

  return (
    <View style={styles.wrap}>
      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      {showStatusLine ? (
        <View style={styles.statusRow}>
          {contactGate === "checking" ? (
            <>
              <ActivityIndicator size="small" color={c.brandNavy} />
              <Text style={[styles.hint, { color: c.textMuted, marginBottom: 0 }]}>
                {channel === "email" ? t("auth.checkingEmail") : t("auth.checkingPhone")}
              </Text>
            </>
          ) : contactMessage ? (
            <Text
              style={[
                styles.hint,
                {
                  color: contactGate === "unavailable" ? c.danger : c.textMuted,
                  marginBottom: 0,
                },
              ]}
            >
              {contactMessage}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showSendButton ? (
        <Button
          label={channel === "email" ? t("auth.sendEmailOtp") : t("auth.sendSmsOtp")}
          variant="secondary"
          size="sm"
          loading={loading}
          onPress={() => void sendCode()}
          leftIcon={channel === "email" ? "mail-outline" : "phone-portrait-outline"}
        />
      ) : null}

      {sent ? (
        <View style={styles.verifyBlock}>
          <FormField
            label={t("auth.verificationCode")}
            placeholder={t("auth.sixDigitCode")}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
            autoComplete={channel === "sms" ? "sms-otp" : "one-time-code"}
          />
          <View style={styles.btnRow}>
            <Button
              label={t("auth.verify")}
              size="sm"
              loading={loading}
              disabled={code.length < 6}
              onPress={() => void verify()}
              style={{ flex: 1 }}
            />
            <Button
              label={cooldown > 0 ? t("auth.resendCooldown", { seconds: cooldown }) : t("auth.resend")}
              variant="ghost"
              size="sm"
              disabled={cooldown > 0 || loading || !canSendOtp}
              onPress={() => void sendCode()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xs, marginBottom: space.sm },
  hint: { ...typography.caption, marginTop: space.xs, marginBottom: space.sm },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.sm,
  },
  error: { ...typography.caption, marginBottom: space.xs },
  verifyBlock: { gap: space.sm },
  btnRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: space.xs,
    marginBottom: space.sm,
  },
  verifiedText: { ...typography.label, fontWeight: "600" },
});
