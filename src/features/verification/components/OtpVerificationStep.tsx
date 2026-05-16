import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Banner, Button, FormField, Stack } from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { colors, radii, space, typography } from "../../../theme";
import { sendVerificationOtp, verifyVerificationOtp } from "../verificationApi";

const RESEND_SECONDS = 60;

type Props = {
  channel: "email" | "sms";
  destination: string;
  title: string;
  description: string;
  onVerified: () => void;
};

export function OtpVerificationStep({
  channel,
  destination,
  title,
  description,
  onVerified,
}: Props) {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendCode = useCallback(async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await sendVerificationOtp(channel);
      setSent(true);
      setCooldown(RESEND_SECONDS);
      setInfo(
        channel === "email"
          ? `We sent a 6-digit code to ${destination}. Check your inbox and spam folder.`
          : `We sent a 6-digit code to ${destination}.`
      );
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not send code. Try again."));
    } finally {
      setLoading(false);
    }
  }, [channel, destination]);

  const verify = useCallback(async () => {
    if (code.trim().length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifyVerificationOtp(channel, code.trim());
      onVerified();
    } catch (e) {
      setError(getApiErrorMessage(e, "Invalid or expired code."));
    } finally {
      setLoading(false);
    }
  }, [channel, code, onVerified]);

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons
          name={channel === "email" ? "mail-outline" : "phone-portrait-outline"}
          size={28}
          color={colors.brand}
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.destinationBox}>
        <Text style={styles.destinationLabel}>
          {channel === "email" ? "Email address" : "Mobile number"}
        </Text>
        <Text style={styles.destination}>{destination}</Text>
      </View>

      <Stack gap="md">
        {error ? <Banner tone="danger" title={error} /> : null}
        {info ? <Banner tone="info" title={info} /> : null}

        {!sent ? (
          <Button
            label="Send verification code"
            size="lg"
            loading={loading}
            onPress={() => void sendCode()}
            leftIcon="paper-plane-outline"
          />
        ) : (
          <>
            <FormField
              label="Verification code"
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
              autoComplete={channel === "sms" ? "sms-otp" : "one-time-code"}
            />
            <Button
              label="Verify and continue"
              size="lg"
              loading={loading}
              disabled={code.length < 6}
              onPress={() => void verify()}
              leftIcon="shield-checkmark-outline"
            />
            <Button
              label={cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
              variant="secondary"
              disabled={cooldown > 0 || loading}
              onPress={() => void sendCode()}
            />
          </>
        )}
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  title: { ...typography.titleMd, color: colors.text, marginBottom: space.xs },
  description: { ...typography.bodyMd, color: colors.textMuted, marginBottom: space.md },
  destinationBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  destinationLabel: { ...typography.label, color: colors.textMuted, marginBottom: 4 },
  destination: { ...typography.bodyMd, color: colors.text, fontWeight: "600" },
});
