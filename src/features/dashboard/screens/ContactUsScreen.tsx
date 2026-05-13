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
  View,
} from "react-native";
import { Button, FormField } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { postWriteUs } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import type { MenuStackParamList } from "../../../navigation/types";

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
          <Ionicons name="mail-outline" size={36} color={colors.brandNavy} />
          <Text style={styles.heroTitle}>Contact NetQwix</Text>
          <Text style={styles.heroSub}>
            Have a question or issue? Send us a message and we'll respond as soon as possible.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.altCard, pressed && { opacity: 0.85 }]}
          onPress={() =>
            navigation.navigate("ShellSurface", { surfaceId: "reportIssue" })
          }
        >
          <View style={styles.altIcon}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.warning} />
          </View>
          <View style={styles.altText}>
            <Text style={styles.altTitle}>Report a Technical issue / Request a refund</Text>
            <Text style={styles.altSub}>
              Pick a session and tell us what went wrong.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Write us</Text>

          <FormField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <FormField
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 0100"
            keyboardType="phone-pad"
          />
          <FormField
            label="Subject"
            value={subject}
            onChangeText={setSubject}
            placeholder="What is this about?"
            returnKeyType="next"
          />
          <FormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your question or issue in detail..."
            multiline
            numberOfLines={6}
            inputStyle={styles.textarea}
          />

          <Button
            label={loading ? "Sending..." : "Send Message"}
            onPress={handleSubmit}
            disabled={loading}
            loading={loading}
            style={{ marginTop: space.sm }}
          />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={colors.brandNavy} />
            <Text style={styles.infoText}>support@netqwix.com</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="globe-outline" size={18} color={colors.brandNavy} />
            <Text style={styles.infoText}>www.netqwix.com</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },

  heroCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.lg,
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTitle: { ...typography.titleMd, color: colors.brandNavy },
  heroSub: { ...typography.bodyMd, color: colors.textMuted, textAlign: "center" },

  altCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.warningSubtle,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  altIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warningSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  altText: { flex: 1 },
  altTitle: { ...typography.bodyMd, fontWeight: "700", color: colors.text },
  altSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  form: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: { ...typography.titleSm, color: colors.brandNavy, marginBottom: 4 },
  textarea: { minHeight: 120 },

  infoSection: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  infoText: { ...typography.bodyMd, color: colors.textSecondary },
});
