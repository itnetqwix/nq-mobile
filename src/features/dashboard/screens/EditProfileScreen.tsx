import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  Button,
  Card,
  FormField,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { AccountType } from "../../../constants/accountType";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import type { MenuStackParamList } from "../../../navigation/types";
import { space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import {
  postUpdateMobileNumber,
  putProfile,
  type ProfileUpdate,
} from "../../home/api/homeApi";

export function EditProfileScreen() {
  const c = useThemeColors();
  const styles = useThemedStyles((palette) => StyleSheet.create({
  avatarSection: {
    alignItems: "center",
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  avatarWrap: { position: "relative" },
  avatarImg: { width: 96, height: 96, borderRadius: 48, backgroundColor: palette.surfaceMuted },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.brandNavy,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.surface,
  },
  changePhotoText: {
    ...typography.bodySm,
    color: palette.brandAccent,
    fontWeight: "600",
    marginTop: space.xs,
  },
  sectionCard: { marginBottom: space.sm },
  fieldStack: { gap: space.md },
  enhanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: palette.brandAccentSubtle,
    borderRadius: 20,
    gap: 6,
    marginTop: 4,
  },
  enhanceBtnText: {
    ...typography.label,
    color: palette.brandAccent,
    fontSize: 13,
  },
});

  const { user, accountType, refreshUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();
  const isTrainer = accountType === AccountType.TRAINER;
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  const currentAvatar = localAvatar ?? getS3ImageUrl((user?.profile_picture as string) ?? "");

  const pickAndUploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setAvatarUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("profile_picture", {
        uri: asset.uri,
        type: asset.mimeType ?? "image/jpeg",
        name: asset.fileName ?? "avatar.jpg",
      } as any);

      await apiClient.put("/common/update-profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLocalAvatar(asset.uri);
      await refreshUser();
    } catch (e) {
      Alert.alert("Upload failed", getApiErrorMessage(e, "Could not update profile picture."));
    } finally {
      setAvatarUploading(false);
    }
  };

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

  const displayName = initial.fullname || "User";

  return (
    <ScreenContainer scroll padding="md" background={c.surface}>
      <View style={styles.avatarSection}>
        <Pressable onPress={pickAndUploadAvatar} disabled={avatarUploading} style={styles.avatarWrap}>
          {currentAvatar ? (
            <Image
              source={{ uri: currentAvatar }}
              style={styles.avatarImg}
            />
          ) : (
            <Avatar name={displayName} size="xl" />
          )}
          <View style={styles.cameraBadge}>
            {avatarUploading ? (
              <ActivityIndicator size={14} color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 14 }}>📷</Text>
            )}
          </View>
        </Pressable>
        <Pressable onPress={pickAndUploadAvatar} disabled={avatarUploading}>
          <Text style={styles.changePhotoText}>
            {avatarUploading ? "Uploading…" : "Change photo"}
          </Text>
        </Pressable>
      </View>

      <SectionHeader label="Identity" />
      <Card variant="outlined" padding="md" style={styles.sectionCard}>
        <View style={styles.fieldStack}>
          <FormField
            label="Full name"
            value={fullname}
            onChangeText={setFullname}
            placeholder="Your full name"
            required
          />
          <FormField
            label="Mobile number"
            value={mobile}
            onChangeText={setMobile}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />
        </View>
      </Card>

      <SectionHeader label="Preferences" />
      <Card variant="outlined" padding="md" style={styles.sectionCard}>
        <FormField
          label="Timezone"
          value={timeZone}
          onChangeText={setTimeZone}
          placeholder="e.g. America/New_York"
          autoCapitalize="none"
          hint="IANA timezone identifier"
        />
      </Card>

      {isTrainer && (
        <>
          <SectionHeader label="Trainer profile" />
          <Card variant="outlined" padding="md" style={styles.sectionCard}>
            <View style={styles.fieldStack}>
              <FormField
                label="Hourly rate"
                value={hourlyRate}
                onChangeText={setHourlyRate}
                placeholder="e.g. 20"
                keyboardType="numeric"
              />
              <FormField
                label="Bio"
                value={bio}
                onChangeText={setBio}
                placeholder="Tell trainees about yourself"
                multiline
                inputStyle={{ minHeight: 110, textAlignVertical: "top" }}
              />
              <Pressable
                onPress={async () => {
                  try {
                    setEnhancing(true);
                    const res = await apiClient.get(API_ROUTES.ai.enhanceProfile);
                    const r = res.data?.result;
                    if (r?.enhancedBio) {
                      Alert.alert(
                        "AI-Enhanced Bio",
                        r.enhancedBio,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Apply", onPress: () => setBio(r.enhancedBio) },
                        ]
                      );
                    }
                  } catch {
                    Alert.alert("Error", "Could not enhance profile right now.");
                  } finally {
                    setEnhancing(false);
                  }
                }}
                style={[styles.enhanceBtn, enhancing && { opacity: 0.6 }]}
                disabled={enhancing}
              >
                {enhancing ? (
                  <ActivityIndicator size="small" color={c.brandAccent} />
                ) : (
                  <Ionicons name="sparkles" size={16} color={c.brandAccent} />
                )}
                <Text style={styles.enhanceBtnText}>
                  {enhancing ? "Enhancing..." : "Enhance with AI"}
                </Text>
              </Pressable>
            </View>
          </Card>
        </>
      )}

      <Button
        label="Save changes"
        leftIcon="checkmark"
        loading={busy}
        disabled={!dirty}
        onPress={save}
        size="lg"
      />
    </ScreenContainer>
  );
}


