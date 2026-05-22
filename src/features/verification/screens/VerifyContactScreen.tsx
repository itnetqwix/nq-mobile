import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { Banner, Button, ScreenContainer } from "../../../components/ui";
import { AuthEscapeLink } from "../../auth/components/AuthEscapeLink";
import { useAuth } from "../../auth/context/AuthContext";
import { OtpVerificationStep } from "../components/OtpVerificationStep";
import { VerificationProgressHeader } from "../components/VerificationProgressHeader";
import { getVerificationStatus, type OnboardingStatus } from "../verificationApi";
import { colors, space, typography } from "../../../theme";

type ContactPhase = "email" | "phone";

type Props = { onDone: () => void };

export function VerifyContactScreen({ onDone }: Props) {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<ContactPhase>("email");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getVerificationStatus();
      setStatus(s);
      if (s.contact_substep === "phone") setPhase("phone");
      else if (s.contact_substep === "complete" || (s.email_verified && s.phone_verified)) {
        await refreshUser();
        onDone();
        return;
      } else if (s.email_verified) {
        setPhase("phone");
      } else {
        setPhase("email");
      }
    } finally {
      setLoading(false);
    }
  }, [onDone, refreshUser]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.email_verified && phase === "email") {
      setPhase("phone");
    }
  }, [status?.email_verified, phase]);

  const emailDone = Boolean(status?.email_verified);
  const phoneDone = Boolean(status?.phone_verified);

  const handleEmailVerified = async () => {
    await loadStatus();
    setPhase("phone");
  };

  const handlePhoneVerified = async () => {
    await refreshUser();
    onDone();
  };

  if (loading && !status) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  const emailDest =
    status?.email_masked ||
    (typeof user?.email === "string" ? user.email : "your email");
  const phoneDest =
    status?.phone_masked ||
    (typeof user?.mobile_no === "string" ? user.mobile_no : "your phone");

  return (
    <ScreenContainer scroll applyTopInset padding="lg" background={colors.background}>
      <AuthEscapeLink variant="signout" />
      <View style={styles.brand}>
        <NetqwixLogo maxWidth={200} />
      </View>

      <VerificationProgressHeader
        phase={1}
        phaseTotal={3}
        title="Confirm your contact details"
        subtitle="If you already verified email and phone during signup, this step is skipped automatically."
        steps={[
          {
            key: "email",
            label: emailDone ? "Email confirmed" : "Confirm email",
            done: emailDone,
            active: phase === "email" && !emailDone,
          },
          {
            key: "phone",
            label: phoneDone ? "Phone confirmed" : "Confirm phone",
            done: phoneDone,
            active: phase === "phone" && !phoneDone,
          },
        ]}
      />

      {emailDone && phase === "email" ? (
        <Banner
          tone="success"
          title="Email already verified"
          description="This address was confirmed during signup or sign-in."
        />
      ) : null}

      {emailDone && phoneDone ? (
        <Banner
          tone="success"
          title="Contact already verified"
          description="Email and phone were confirmed during signup. Taking you to the next step."
        />
      ) : null}

      {phase === "email" && !emailDone ? (
        <OtpVerificationStep
          channel="email"
          destination={emailDest}
          title="Verify your email"
          description="Enter the code we send to your inbox. This confirms you own the address on your account."
          onVerified={() => void handleEmailVerified()}
        />
      ) : null}

      {phase === "phone" && !phoneDone ? (
        <>
          {emailDone ? (
            <Text style={styles.phoneIntro}>
              Last step for contact verification: confirm you can receive texts at the number on your
              account.
            </Text>
          ) : null}
          <OtpVerificationStep
            channel="sms"
            destination={phoneDest}
            title="Verify your phone"
            description="Enter the SMS code we send to your mobile number. Standard message rates may apply."
            onVerified={() => void handlePhoneVerified()}
          />
        </>
      ) : null}

      {emailDone && phoneDone ? (
        <Button label="Continue" size="lg" onPress={() => void handlePhoneVerified()} />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginBottom: space.lg, marginTop: space.md },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  phoneIntro: {
    ...typography.bodyMd,
    color: colors.textMuted,
    marginBottom: space.md,
  },
});
