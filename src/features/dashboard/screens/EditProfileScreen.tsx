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
  HelpBubble,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { AccountType } from "../../../constants/accountType";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { resolveProfileImageUrl } from "../../../lib/profileImage";
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
import { useAppTranslation } from "../../../i18n/useAppTranslation";

export function EditProfileScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useThemedStyles((palette) => StyleSheet.create({
  avatarSection: {
    alignItems: "center",
    paddingVertical: space.sm,
    marginBottom: space.xs,
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
}));

  const { user, accountType, refreshUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();
  const isTrainer = accountType === AccountType.TRAINER;
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  const currentAvatar =
    localAvatar ?? resolveProfileImageUrl(user as Record<string, unknown>);

  const pickAndUploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("profile.permissionTitle"), t("profile.permissionLibrary"));
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
      Alert.alert(t("profile.uploadFailedTitle"), getApiErrorMessage(e, t("profile.uploadFailedBody")));
    } finally {
      setAvatarUploading(false);
    }
  };

  const initial = useMemo(
    () => ({
      fullname: (user?.fullname as string) || (user?.fullName as string) || "",
      bio: (user?.bio as string) || "",
      mobile_no: (user?.mobile_no as string) || "",
      hourly_rate: ((user as any)?.extraInfo?.hourly_rate as string) || "",
    }),
    [user]
  );

  const [fullname, setFullname] = useState(initial.fullname);
  const [bio, setBio] = useState(initial.bio);
  const [mobile, setMobile] = useState(initial.mobile_no);
  const [hourlyRate, setHourlyRate] = useState(initial.hourly_rate);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullname(initial.fullname);
    setBio(initial.bio);
    setMobile(initial.mobile_no);
    setHourlyRate(initial.hourly_rate);
  }, [initial]);

  const dirty =
    fullname !== initial.fullname ||
    bio !== initial.bio ||
    mobile !== initial.mobile_no ||
    hourlyRate !== initial.hourly_rate;

  const save = async () => {
    if (!fullname.trim()) {
      Alert.alert(t("profile.nameRequiredTitle"), t("profile.nameRequiredBody"));
      return;
    }
    setBusy(true);
    try {
      const profile: ProfileUpdate = {
        fullname: fullname.trim(),
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
          Alert.alert(t("profile.mobileNotUpdatedTitle"), getApiErrorMessage(e, t("profile.mobileNotUpdatedBody")));
        }
      }
      await refreshUser();
      Alert.alert(t("profile.savedTitle"), t("profile.savedBody"));
      navigation.goBack();
    } catch (e) {
      Alert.alert(t("profile.saveFailedTitle"), getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const displayName = initial.fullname || t("profile.userDefault");

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
            {avatarUploading ? t("profile.uploadingPhoto") : t("profile.changePhoto")}
          </Text>
        </Pressable>
      </View>

      <SectionHeader label={t("profile.identitySection")} />
      <Card variant="outlined" padding="md" style={styles.sectionCard}>
        <View style={styles.fieldStack}>
          <FormField
            label={t("profile.fullNameLabel")}
            value={fullname}
            onChangeText={setFullname}
            placeholder={t("profile.fullNamePlaceholder")}
            required
          />
          <FormField
            label={t("profile.mobileLabel")}
            value={mobile}
            onChangeText={setMobile}
            placeholder={t("profile.mobilePlaceholder")}
            keyboardType="phone-pad"
          />
        </View>
      </Card>

      {isTrainer && (
        <>
          <SectionHeader label={t("profile.trainerSection")} />
          <Card variant="outlined" padding="md" style={styles.sectionCard}>
            <View style={styles.fieldStack}>
              <FormField
                label={t("profile.hourlyRateLabel")}
                value={hourlyRate}
                onChangeText={setHourlyRate}
                placeholder={t("profile.hourlyRatePlaceholder")}
                keyboardType="numeric"
                labelAdornment={
                  <HelpBubble
                    topic={t("help.hourlyRate.topic", { defaultValue: "Hourly rate" })}
                  >
                    {t("help.hourlyRate.body", {
                      defaultValue:
                        "Charge per booked hour. NetQwix takes a platform commission (typically 20%) and the rest is your earnings. Set this where your bookings are competitive — you can update it any time and existing bookings keep their original price.",
                    })}
                  </HelpBubble>
                }
              />
              <FormField
                label={t("profile.bioLabel")}
                value={bio}
                onChangeText={setBio}
                placeholder={t("profile.bioPlaceholder")}
                multiline
                inputStyle={{ minHeight: 110, textAlignVertical: "top" }}
              />
              <Pressable
                onPress={() =>
                  navigation.navigate("ShellSurface", { surfaceId: "professionalProfile" })
                }
                style={styles.enhanceBtn}
              >
                <Ionicons name="ribbon-outline" size={16} color={c.brandAccent} />
                <Text style={styles.enhanceBtnText}>{t("trainerProfile.editProfessional")}</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    setEnhancing(true);
                    const res = await apiClient.get(API_ROUTES.ai.enhanceProfile);
                    const r = res.data?.result;
                    if (r?.enhancedBio) {
                      Alert.alert(
                        t("profile.aiBioTitle"),
                        r.enhancedBio,
                        [
                          { text: t("common.cancel"), style: "cancel" },
                          { text: t("profile.apply"), onPress: () => setBio(r.enhancedBio) },
                        ]
                      );
                    }
                  } catch {
                    Alert.alert(t("common.error"), t("profile.enhanceError"));
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
                  {enhancing ? t("profile.enhancing") : t("profile.enhanceWithAi")}
                </Text>
              </Pressable>
            </View>
          </Card>
        </>
      )}

      <Button
        label={t("profile.saveChanges")}
        leftIcon="checkmark"
        loading={busy}
        disabled={!dirty}
        onPress={save}
        size="lg"
      />
    </ScreenContainer>
  );
}


