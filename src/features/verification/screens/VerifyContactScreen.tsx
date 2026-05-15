import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from "react-native";
import { sendVerificationOtp, verifyVerificationOtp } from "../verificationApi";

type Props = { onDone: () => void };

export function VerifyContactScreen({ onDone }: Props) {
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Verify contact</Text>
      <Text style={styles.sub}>Step 1: email and phone OTP</Text>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Text style={styles.label}>Email</Text>
      <Button title="Send email code" onPress={() => sendVerificationOtp("email").then(() => setMsg("Email code sent"))} />
      <TextInput style={styles.input} value={emailCode} onChangeText={setEmailCode} keyboardType="number-pad" placeholder="Email OTP" />
      <Button title="Verify email" onPress={() => verifyVerificationOtp("email", emailCode).then(() => setMsg("Email verified"))} />

      <Text style={[styles.label, { marginTop: 24 }]}>Phone</Text>
      <Button title="Send SMS code" onPress={() => sendVerificationOtp("sms").then(() => setMsg("SMS code sent"))} />
      <TextInput style={styles.input} value={smsCode} onChangeText={setSmsCode} keyboardType="number-pad" placeholder="SMS OTP" />
      <Button
        title="Continue"
        onPress={async () => {
          try {
            await verifyVerificationOtp("sms", smsCode);
            onDone();
          } catch (e: any) {
            setMsg(e?.message || "Verify phone failed");
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  sub: { color: "#666", marginBottom: 16 },
  label: { fontWeight: "600", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 12 },
  msg: { color: "#000080", marginBottom: 12 },
});
