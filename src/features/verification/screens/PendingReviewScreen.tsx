import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { AuthEscapeLink } from "../../auth/components/AuthEscapeLink";
import { getVerificationStatus } from "../verificationApi";

type Props = { onApproved: () => void };

export function PendingReviewScreen({ onApproved }: Props) {
  useEffect(() => {
    const t = setInterval(() => {
      void getVerificationStatus().then((s) => {
        if (s.step === "completed" && s.status === "approved") onApproved();
      });
    }, 30000);
    return () => clearInterval(t);
  }, [onApproved]);

  return (
    <View style={styles.container}>
      <AuthEscapeLink variant="signout" />
      <Text style={styles.title}>Under review</Text>
      <Text style={styles.body}>
        We received your application. Review typically completes within 48 hours. You will be notified by email.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: "#444" },
});
