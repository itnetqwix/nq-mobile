import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import { radii, space } from "../../../theme/tokens";
import { useAuth } from "../../auth/context/AuthContext";
import { postWriteUs } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import type { MenuStackParamList } from "../../../navigation/types";

const NAVY = "#000080";

/**
 * Web parity: this is the trainee/trainer "Contact Us" hub. It has TWO entries (same as
 * `nq-frontend-main/app/components/contactUs/index.jsx`):
 *   1) Write Us → `POST /user/write-us` with `{ name, email, phone_number, subject, description }`.
 *   2) Report a technical issue / Request a refund → opens the session-picker shell,
 *      which then posts to `/user/raise-concern`.
 */
export function ContactUsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();
  const { user } = useAuth();

  const presetName = (user?.fullname as string) ?? (user?.fullName as string) ?? "";
  const presetEmail = (user?.email as string) ?? "";
  const presetPhone = (user?.mobile_no as string) ?? (user?.phone as string) ?? "";

  const [name, setName] = useState(presetName);
  const [email, setEmail] = useState(presetEmail);
  const [phone, setPhone] = useState(presetPhone);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert("Required", "Please fill in both subject and description.");
      return;
    }
    setLoading(true);
    try {
      await postWriteUs({
        name: name.trim() || presetName,
        email: (email.trim() || presetEmail).toLowerCase(),
        phone_number: phone.trim() || presetPhone,
        subject: subject.trim(),
        description: description.trim(),
      });
      Alert.alert(
        "Sent!",
        "Your message has been sent. We'll get back to you soon."
      );
      setSubject("");
      setDescription("");
    } catch (e) {
      Alert.alert("Error", getApiErrorMessage(e, "Failed to send message. Please try again."));
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

        {/* Web parity: trainees can also report a technical issue or request a refund
            tied to a specific session — opens a dedicated picker + form shell. */}
        <Pressable
          style={({ pressed }) => [styles.altCard, pressed && { opacity: 0.85 }]}
          onPress={() =>
            navigation.navigate("ShellSurface", { surfaceId: "reportIssue" })
          }
        >
          <View style={styles.altIcon}>
            <Ionicons name="alert-circle-outline" size={24} color="#b45309" />
          </View>
          <View style={styles.altText}>
            <Text style={styles.altTitle}>Report a Technical issue / Request a refund</Text>
            <Text style={styles.altSub}>
              Pick a session and tell us what went wrong — same flow as the website.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </Pressable>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Write us</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Phone (optional)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 0100"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="What is this about?"
            placeholderTextColor="#9ca3af"
            value={subject}
            onChangeText={setSubject}
            returnKeyType="next"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe your question or issue in detail..."
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              (pressed || loading) && styles.submitBtnPressed,
            ]}
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

  altCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: "#fffbeb",
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  altIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  altText: { flex: 1 },
  altTitle: { fontSize: 14, fontWeight: "700", color: "#92400e" },
  altSub: { fontSize: 12, color: "#a16207", marginTop: 2, lineHeight: 17 },

  form: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  formTitle: { fontSize: 16, fontWeight: "700", color: NAVY, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "700", color: "#374151" },
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
