import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { colors, radii, space } from "../../../theme/tokens";
import type { MenuStackParamList } from "../../../navigation/types";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import {
  postUpdateMobileNumber,
  putProfile,
  type ProfileUpdate,
} from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";

/** Mirrors the website "Trainer profile" / "Edit profile" page — name + mobile + timezone + bio. */
export function EditProfileScreen() {
  const { user, accountType, refreshUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();
  const isTrainer = accountType === AccountType.TRAINER;

  const initial = useMemo(
    () => ({
      fullname: (user?.fullname as string) || (user?.fullName as string) || "",
      bio: (user?.bio as string) || "",
      time_zone: (user?.time_zone as string) || "America/New_York",
      mobile_no: (user?.mobile_no as string) || "",
      hourly_rate: ((user as any)?.extraInfo?.hourly_rate as string) || "",
    }),
    [user]
  );

  const [fullname, setFullname] = useState(initial.fullname);
  const [bio, setBio] = useState(initial.bio);
  const [timeZone, setTimeZone] = useState(initial.time_zone);
  const [mobile, setMobile] = useState(initial.mobile_no);
  const [hourlyRate, setHourlyRate] = useState(initial.hourly_rate);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullname(initial.fullname);
    setBio(initial.bio);
    setTimeZone(initial.time_zone);
    setMobile(initial.mobile_no);
    setHourlyRate(initial.hourly_rate);
  }, [initial]);

  const dirty =
    fullname !== initial.fullname ||
    bio !== initial.bio ||
    timeZone !== initial.time_zone ||
    mobile !== initial.mobile_no ||
    hourlyRate !== initial.hourly_rate;

  const save = async () => {
    if (!fullname.trim()) {
      Alert.alert("Name is required", "Please enter your full name before saving.");
      return;
    }
    setBusy(true);
    try {
      const profile: ProfileUpdate = {
        fullname: fullname.trim(),
        time_zone: timeZone.trim(),
        bio: bio.trim(),
      };
      if (isTrainer && hourlyRate) {
        profile.hourly_rate = hourlyRate.trim();
      }
      await putProfile(isTrainer ? "Trainer" : "Trainee", profile);
      if (mobile.trim() && mobile.trim() !== initial.mobile_no) {
        try {
          await postUpdateMobileNumber(mobile.trim());
        } catch (e) {
          Alert.alert("Mobile not updated", getApiErrorMessage(e, "Could not update mobile number."));
        }
      }
      await refreshUser();
      Alert.alert("Profile saved", "Your changes are live.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Save failed", getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Updates go to the same endpoints as the website:{" "}
          {isTrainer ? "PUT /trainer/profile" : "PUT /trainee/profile"} and
          POST /user/update-mobile-number.
        </Text>

        <Section title="Identity">
          <Field
            label="Full name"
            value={fullname}
            onChangeText={setFullname}
            placeholder="Your full name"
          />
          <Field
            label="Mobile number"
            value={mobile}
            onChangeText={setMobile}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />
        </Section>

        <Section title="Preferences">
          <Field
            label="Timezone"
            value={timeZone}
            onChangeText={setTimeZone}
            placeholder="e.g. America/New_York"
            autoCapitalize="none"
          />
        </Section>

        {isTrainer && (
          <Section title="Trainer profile">
            <Field
              label="Hourly rate"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              placeholder="e.g. 20"
              keyboardType="numeric"
            />
            <Field
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell trainees about yourself"
              multiline
            />
          </Section>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            (!dirty || busy || pressed) && { opacity: !dirty ? 0.5 : 0.9 },
          ]}
          disabled={!dirty || busy}
          onPress={save}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Save changes</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={!!multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl * 2 },
  lead: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  section: {},
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.md,
  },

  fieldRow: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: "#fff",
  },
  inputMultiline: { height: 110, textAlignVertical: "top" },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingVertical: 14,
    marginTop: space.sm,
  },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
