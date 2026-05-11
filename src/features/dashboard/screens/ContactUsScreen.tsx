import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radii, space } from "../../../theme/tokens";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

const NAVY = "#000080";

export function ContactUsScreen() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Required", "Please fill in both subject and message.");
      return;
    }
    setLoading(true);
    try {
      await apiClient.post(API_ROUTES.user.writeUs, { subject, message });
      Alert.alert("Sent!", "Your message has been sent. We'll get back to you soon.");
      setSubject("");
      setMessage("");
    } catch {
      Alert.alert("Error", "Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Ionicons name="mail-outline" size={36} color={NAVY} />
          <Text style={styles.heroTitle}>Contact NetQwix</Text>
          <Text style={styles.heroSub}>
            Have a question or issue? Send us a message and we'll respond as soon as possible.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="What is this about?"
            placeholderTextColor="#9ca3af"
            value={subject}
            onChangeText={setSubject}
            returnKeyType="next"
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe your question or issue in detail..."
            placeholderTextColor="#9ca3af"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <Pressable
            style={({ pressed }) => [styles.submitBtn, (pressed || loading) && styles.submitBtnPressed]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>
              {loading ? "Sending..." : "Send Message"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={NAVY} />
            <Text style={styles.infoText}>support@netqwix.com</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="globe-outline" size={18} color={NAVY} />
            <Text style={styles.infoText}>www.netqwix.com</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  heroTitle: { fontSize: 20, fontWeight: "700", color: NAVY },
  heroSub: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },

  form: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  label: { fontSize: 14, fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: radii.sm,
    padding: space.sm,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  textarea: { minHeight: 120 },

  submitBtn: {
    backgroundColor: NAVY,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.sm,
  },
  submitBtnPressed: { opacity: 0.75 },
  submitBtnText: { fontSize: 15, color: "#fff", fontWeight: "700" },

  infoSection: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  infoText: { fontSize: 14, color: "#374151" },
});
