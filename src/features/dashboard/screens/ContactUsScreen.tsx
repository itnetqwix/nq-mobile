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
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { postWriteUs } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { useSubmitGuard } from "../../../lib/timing";
import type { MenuStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

/**
 * Web parity: this is the trainee/trainer "Contact Us" hub. It has TWO entries (same as
 * `nq-frontend-main/app/components/contactUs/index.jsx`):
 *   1) Write Us → `POST /user/write-us` with `{ name, email, phone_number, subject, description }`.
 *   2) Report a technical issue / Request a refund → opens the session-picker shell,
 *      which then posts to `/user/raise-concern`.
 */
export function ContactUsScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useContactStyles();
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
  const { submitting: loading, guard: guardSubmit } = useSubmitGuard();

  const handleSubmit = async () => {
    await guardSubmit(async () => {
      if (!subject.trim() || !description.trim()) {
        Alert.alert(t("support.requiredTitle"), t("support.requiredBody"));
        return;
      }
      try {
        await postWriteUs({
          name: name.trim() || presetName,
          email: (email.trim() || presetEmail).toLowerCase(),
          phone_number: phone.trim() || presetPhone,
          subject: subject.trim(),
          description: description.trim(),
        });
        Alert.alert(t("support.sentTitle"), t("support.sentBody"));
        setSubject("");
        setDescription("");
      } catch (e) {
        Alert.alert(t("common.error"), getApiErrorMessage(e, t("support.sendFailed")));
      }
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Ionicons name="mail-outline" size={36} color={c.iconPrimary} />
          <Text style={styles.heroTitle}>{t("support.heroTitle")}</Text>
          <Text style={styles.heroSub}>{t("support.heroSub")}</Text>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>{t("support.tipsTitle")}</Text>
          <Text style={styles.tipsBody}>{t("support.tipsBody")}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.altCard, pressed && { opacity: 0.85 }]}
          onPress={() =>
            navigation.navigate("ShellSurface", { surfaceId: "reportIssue" })
          }
        >
          <View style={styles.altIcon}>
            <Ionicons name="alert-circle-outline" size={24} color={c.warning} />
          </View>
          <View style={styles.altText}>
            <Text style={styles.altTitle}>{t("support.altTitle")}</Text>
            <Text style={styles.altSub}>{t("support.altSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </Pressable>

        <View style={styles.form}>
          <Text style={styles.formTitle}>{t("support.formTitle")}</Text>

          <FormField
            label={t("support.nameLabel")}
            value={name}
            onChangeText={setName}
            placeholder={t("support.namePlaceholder")}
          />
          <FormField
            label={t("support.emailLabel")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("support.emailPlaceholder")}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <FormField
            label={t("support.phoneLabel")}
            value={phone}
            onChangeText={setPhone}
            placeholder={t("support.phonePlaceholder")}
            keyboardType="phone-pad"
          />
          <FormField
            label={t("support.subjectLabel")}
            value={subject}
            onChangeText={setSubject}
            placeholder={t("support.subjectPlaceholder")}
            returnKeyType="next"
          />
          <FormField
            label={t("support.descriptionLabel")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("support.descriptionPlaceholder")}
            multiline
            numberOfLines={6}
            inputStyle={styles.textarea}
          />

          <Button
            label={loading ? t("support.sending") : t("support.sendMessage")}
            onPress={handleSubmit}
            disabled={loading}
            loading={loading}
            style={{ marginTop: space.sm }}
          />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={c.iconPrimary} />
            <Text style={styles.infoText}>support@netqwix.com</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="globe-outline" size={18} color={c.iconPrimary} />
            <Text style={styles.infoText}>www.netqwix.com</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useContactStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.background },
      content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
      heroCard: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.lg,
        alignItems: "center",
        gap: space.sm,
        borderWidth: 1,
        borderColor: palette.border,
      },
      heroTitle: { ...typography.titleMd, color: palette.iconPrimary },
      heroSub: { ...typography.bodyMd, color: palette.textMuted, textAlign: "center" },
      tipsCard: {
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      tipsTitle: { ...typography.subtitle, color: palette.brandNavy, marginBottom: 6 },
      tipsBody: { ...typography.bodySm, color: palette.textSecondary, lineHeight: 20 },
      altCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: palette.warningSubtle,
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.warning,
      },
      altIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.warningSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      altText: { flex: 1 },
      altTitle: { ...typography.bodyMd, fontWeight: "700", color: palette.text },
      altSub: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
      form: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.md,
        gap: space.sm,
        borderWidth: 1,
        borderColor: palette.border,
      },
      formTitle: { ...typography.titleSm, color: palette.iconPrimary, marginBottom: 4 },
      textarea: { minHeight: 120 },
      infoSection: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.md,
        gap: space.sm,
        borderWidth: 1,
        borderColor: palette.border,
      },
      infoRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
      infoText: { ...typography.bodyMd, color: palette.textSecondary },
    })
  );
}
