import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, FormField } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { sendSignupOtp, verifySignupOtp } from "../api/signupOtpApi";

const RESEND_SECONDS = 60;

type Props = {
  channel: "email" | "sms";
  email?: string;
  mobile?: string;
  disabled?: boolean;
  verified: boolean;
  onVerified: () => void;
  onResetVerified?: () => void;
};

export function SignupInlineOtp({
  channel,
  email,
  mobile,
  disabled,
  verified,
  onVerified,
}: Props) {
  const c = useThemeColors();
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = channel === "email" ? email?.trim() : mobile?.trim();
  const canSend =
    !disabled &&
    !verified &&
    Boolean(destination) &&
    (channel === "email"
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination!)
      : destination!.replace(/\D/g, "").length >= 10);

  useEffect(() => {
    setSent(false);
    setCode("");
    setError(null);
    setCooldown(0);
  }, [destination, channel]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendCode = useCallback(async () => {
    if (!destination) return;
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
      setError(getApiErrorMessage(e, "Could not send code."));
    } finally {
      setLoading(false);
    }
  }, [channel, destination]);

  const verify = useCallback(async () => {
    if (!destination || code.trim().length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifySignupOtp(channel, {
        email: channel === "email" ? destination : undefined,
        mobile_no: channel === "sms" ? destination : undefined,
      }, code.trim());
      onVerified();
    } catch (e) {
      setError(getApiErrorMessage(e, "Invalid or expired code."));
    } finally {
      setLoading(false);
    }
  }, [channel, code, destination, onVerified]);

  if (verified) {
    return (
      <View style={[styles.verifiedRow, { backgroundColor: c.brandSubtle, borderColor: c.success }]}>
        <Ionicons name="checkmark-circle" size={20} color={c.success} />
        <Text style={[styles.verifiedText, { color: c.success }]}>
          {channel === "email" ? "Email verified" : "Phone verified"}
        </Text>
      </View>
    );
  }

  if (disabled) {
    return (
      <Text style={[styles.hint, { color: c.textMuted }]}>
        {channel === "sms"
          ? "Verify your email first, then confirm your phone."
          : "Enter a valid email to receive a code."}
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}

      {!sent ? (
        <Button
          label={channel === "email" ? "Send email OTP" : "Send SMS OTP"}
          variant="secondary"
          size="sm"
          loading={loading}
          disabled={!canSend}
          onPress={() => void sendCode()}
          leftIcon={channel === "email" ? "mail-outline" : "phone-portrait-outline"}
        />
      ) : (
        <View style={styles.verifyBlock}>
          <FormField
            label="Verification code"
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            autoComplete={channel === "sms" ? "sms-otp" : "one-time-code"}
          />
          <View style={styles.btnRow}>
            <Button
              label="Verify"
              size="sm"
              loading={loading}
              disabled={code.length < 6}
              onPress={() => void verify()}
              style={{ flex: 1 }}
            />
            <Button
              label={cooldown > 0 ? `Resend (${cooldown}s)` : "Resend"}
              variant="ghost"
              size="sm"
              disabled={cooldown > 0 || loading}
              onPress={() => void sendCode()}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xs, marginBottom: space.sm },
  hint: { ...typography.caption, marginTop: space.xs, marginBottom: space.sm },
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
