import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Card,
  FormField,
  HelpBubble,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { ProfileAvatar } from "../../../components/ui/ProfileAvatar";
import { AccountType } from "../../../constants/accountType";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { bumpAvatarCacheBust, useAvatarCacheBust } from "../../../lib/avatarCacheBust";
import type { MenuStackParamList } from "../../../navigation/types";
import { openShellSurface } from "../../../navigation/openShellSurface";
import { space, typography, useThemeColors, useThemedStyles, radii } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import {
  postUpdateMobileNumber,
  putProfile,
  type ProfileUpdate,
} from "../../home/api/homeApi";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import {
  buildSocialLinksPayload,
  getSocialLinksFromUser,
  isValidSocialUrl,
} from "../../../lib/social/socialLinks";

const HOURLY_RATE_MIN = 10;
const HOURLY_RATE_MAX = 999;

function resolveHourlyRateFromUser(user: Record<string, unknown> | null | undefined): string {
  if (!user) return "";
  const extra = user.extraInfo as Record<string, unknown> | undefined;
  const fromExtra = extra?.hourly_rate;
  const fromRoot = user.hourly_rate;
  const raw = fromExtra ?? fromRoot;
  if (raw == null || raw === "") return "";
  return String(raw);
}

import { TextInput } from "react-native";

function ZomatoFormField({
  label,
  value,
  onChangeText,
  placeholder,
  rightAction,
  keyboardType = "default",
  secureTextEntry = false,
  multiline = false,
  inputStyle,
  autoCapitalize,
  autoCorrect,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  rightAction?: React.ReactNode;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "url";
  secureTextEntry?: boolean;
  multiline?: boolean;
  inputStyle?: any;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
}) {
  const c = useThemeColors();
  return (
    <View style={{ position: "relative", marginTop: 10, marginBottom: 12 }}>
      {/* Absolute positioned top border cut label */}
      <View
        style={{
          position: "absolute",
          top: -9,
          left: 12,
          backgroundColor: c.surface,
          paddingHorizontal: 6,
          zIndex: 10,
        }}
      >
        <Text style={{ fontSize: 11, color: c.textMuted, fontWeight: "600" }}>{label}</Text>
      </View>

      <View
        style={[
          {
            borderWidth: 1,
            borderColor: "#2D2D3A",
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: multiline ? 8 : 10,
            minHeight: multiline ? 96 : 52,
            backgroundColor: c.surfaceElevated,
            flexDirection: "row",
            alignItems: "center",
          },
          inputStyle,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          style={{
            flex: 1,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: "500",
            paddingVertical: 0,
            textAlignVertical: multiline ? "top" : "center",
          }}
          editable={!!onChangeText}
        />
        {rightAction}
      </View>
    </View>
  );
}

export function EditProfileScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useThemedStyles((palette) => StyleSheet.create({
  avatarSection: {
    alignItems: "center",
    paddingBottom: 24,
    paddingTop: space.sm,
    backgroundColor: palette.surfaceElevated,
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
    width: "100%",
    marginBottom: space.md,
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
    backgroundColor: palette.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FF5A5F",
  },
  changePhotoText: {
    ...typography.bodySm,
    color: palette.brandAccent,
    fontWeight: "600",
    marginTop: space.xs,
  },
  sectionCard: { marginBottom: space.sm, backgroundColor: "transparent", borderWidth: 0 },
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
  publicLinksHint: {
    ...typography.bodySm,
    marginBottom: space.sm,
    lineHeight: 20,
  },
}));

  const { user, accountType, refreshUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();
  const isTrainer = accountType === AccountType.TRAINER;
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  // Local file URI shown immediately after picking — cleared once server refresh succeeds.
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const cacheBust = useAvatarCacheBust();

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

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? "image/jpeg";

    setAvatarUploading(true);
    // Show the local file immediately for instant feedback.
    setLocalAvatar(asset.uri);
    try {
      // Step 1 — ask the server to pre-register the filename and return an
      // S3 pre-signed PUT URL. The server sets profile_picture to the new
      // filename immediately so it is available after we refresh the user.
      const signRes = await apiClient.put(
        "/common/update-profile-picture",
        { fileType: mimeType },
      );
      const presignedUrl: string | undefined =
        signRes.data?.url ?? signRes.data?.data?.url;
      if (!presignedUrl) {
        throw new Error("Server did not return an upload URL.");
      }

      // Step 2 — upload the raw image bytes directly to S3 via the presigned
      // PUT URL. We use the native fetch (not apiClient) so we can send the
      // binary body without auth headers that would break the S3 signature.
      const imageRes = await fetch(asset.uri);
      const blob = await imageRes.blob();
      const s3Res = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });
      if (!s3Res.ok) {
        throw new Error(`S3 upload failed (${s3Res.status})`);
      }

      // Full refresh to guarantee the Redux user is in sync with the server.
      await refreshUser();
      // Bump the global cache-bust token — ProfileAvatar/Avatar everywhere will
      // get a new ?t=<timestamp> URL (new cache key), forcing a fresh disk fetch.
      bumpAvatarCacheBust();
      // Clear local URI so we switch to the fresh server URL.
      setLocalAvatar(null);
    } catch (e) {
      setLocalAvatar(null);
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
      hourly_rate: resolveHourlyRateFromUser(user as Record<string, unknown> | null),
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

  const initialSocial = useMemo(() => {
    const links = getSocialLinksFromUser(user as Record<string, unknown> | null);
    return {
      facebook: links.fb ?? "",
      instagram: links.instagram ?? "",
      website: links.slack ?? "",
    };
  }, [user]);

  const [facebook, setFacebook] = useState(initialSocial.facebook);
  const [instagram, setInstagram] = useState(initialSocial.instagram);
  const [website, setWebsite] = useState(initialSocial.website);

  useEffect(() => {
    setFacebook(initialSocial.facebook);
    setInstagram(initialSocial.instagram);
    setWebsite(initialSocial.website);
  }, [initialSocial]);

  const dirty =
    fullname !== initial.fullname ||
    bio !== initial.bio ||
    mobile !== initial.mobile_no ||
    hourlyRate !== initial.hourly_rate ||
    facebook !== initialSocial.facebook ||
    instagram !== initialSocial.instagram ||
    website !== initialSocial.website;

  const save = async () => {
    if (!fullname.trim()) {
      Alert.alert(t("profile.nameRequiredTitle"), t("profile.nameRequiredBody"));
      return;
    }
    setBusy(true);
    try {
      const socialPayload = buildSocialLinksPayload({ facebook, instagram, website });
      for (const [label, url] of [
        ["Facebook", socialPayload.fb],
        ["Instagram", socialPayload.instagram],
        ["Website", socialPayload.slack],
      ] as const) {
        if (url && !isValidSocialUrl(url)) {
          Alert.alert(
            t("profile.invalidLinkTitle", { defaultValue: "Invalid link" }),
            t("profile.invalidLinkBody", {
              defaultValue: "Please enter a valid {{label}} URL.",
              label,
            })
          );
          setBusy(false);
          return;
        }
      }

      const existingExtra = ((user as Record<string, unknown>)?.extraInfo as Record<string, unknown>) ?? {};
      const existingSocial =
        (existingExtra.social_media_links as Record<string, unknown>) ?? {};

      const profile: ProfileUpdate = {
        fullname: fullname.trim(),
        bio: bio.trim(),
        extraInfo: {
          ...existingExtra,
          social_media_links: {
            ...existingSocial,
            fb: socialPayload.fb ?? "",
            instagram: socialPayload.instagram ?? "",
            slack: socialPayload.slack ?? "",
          },
        },
      };
      if (isTrainer) {
        const trimmed = hourlyRate.trim();
        if (trimmed) {
          const parsed = Number(trimmed);
          if (!Number.isFinite(parsed) || parsed < HOURLY_RATE_MIN || parsed > HOURLY_RATE_MAX) {
            Alert.alert(
              t("profile.saveFailedTitle"),
              t("profile.hourlyRateRange", {
                defaultValue: `Hourly rate must be between $${HOURLY_RATE_MIN} and $${HOURLY_RATE_MAX}.`,
                min: HOURLY_RATE_MIN,
                max: HOURLY_RATE_MAX,
              })
            );
            setBusy(false);
            return;
          }
          profile.extraInfo = {
            ...profile.extraInfo,
            hourly_rate: parsed,
          };
          profile.hourly_rate = String(parsed);
        }
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
    <ScreenContainer scroll padding="md" background={c.surface} clearFloatingTabBar>
      <View style={styles.avatarSection}>
        <Pressable onPress={pickAndUploadAvatar} disabled={avatarUploading} style={styles.avatarWrap}>
          <ProfileAvatar
            uri={localAvatar ?? undefined}
            user={localAvatar ? undefined : (user as Record<string, unknown>)}
            name={displayName}
            size={96}
            cacheBust={localAvatar ? undefined : cacheBust}
          />
          <View style={styles.cameraBadge}>
            {avatarUploading ? (
              <ActivityIndicator size={14} color="#FF5A5F" />
            ) : (
              <Ionicons name="create-outline" size={16} color="#FF5A5F" />
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
          <ZomatoFormField
            label={t("profile.fullNameLabel")}
            value={fullname}
            onChangeText={setFullname}
            placeholder={t("profile.fullNamePlaceholder")}
          />
          <ZomatoFormField
            label={t("profile.mobileLabel")}
            value={mobile}
            onChangeText={setMobile}
            placeholder={t("profile.mobilePlaceholder")}
            keyboardType="phone-pad"
            rightAction={
              <Pressable onPress={() => Alert.alert(t("profile.changeMobileTitle", { defaultValue: "Change Mobile" }), t("profile.changeMobileBody", { defaultValue: "Please contact support to change your mobile number." }))}>
                <Text style={{ color: "#FF5A5F", fontWeight: "700", fontSize: 13, marginRight: 4 }}>
                  {t("profile.change", { defaultValue: "CHANGE" })}
                </Text>
              </Pressable>
            }
          />
          <ZomatoFormField
            label={t("profile.emailLabel", { defaultValue: "Email" })}
            value={user?.email as string ?? ""}
            placeholder={t("profile.emailPlaceholder", { defaultValue: "your@email.com" })}
            rightAction={
              <Pressable onPress={() => Alert.alert(t("profile.changeEmailTitle", { defaultValue: "Change Email" }), t("profile.changeEmailBody", { defaultValue: "Please contact support to change your verified email address." }))}>
                <Text style={{ color: "#FF5A5F", fontWeight: "700", fontSize: 13, marginRight: 4 }}>
                  {t("profile.change", { defaultValue: "CHANGE" })}
                </Text>
              </Pressable>
            }
          />

          {/* Mock fields for visual parity with Image 1 */}
          <ZomatoFormField
            label={t("profile.dobLabel", { defaultValue: "Date of birth" })}
            value="14/09/2001"
            placeholder="DD/MM/YYYY"
          />
          <ZomatoFormField
            label={t("profile.anniversaryLabel", { defaultValue: "Anniversary" })}
            value=""
            placeholder="Select date"
            rightAction={<Ionicons name="calendar-outline" size={18} color={c.textMuted} style={{ marginRight: 4 }} />}
          />
          <ZomatoFormField
            label={t("profile.genderLabel", { defaultValue: "Gender" })}
            value="Male"
            placeholder="Select gender"
            rightAction={<Ionicons name="chevron-down" size={18} color={c.textMuted} style={{ marginRight: 4 }} />}
          />
        </View>
      </Card>

      {isTrainer && (
        <>
          <SectionHeader label={t("profile.trainerSection")} />
          <Card variant="outlined" padding="md" style={styles.sectionCard}>
            <View style={styles.fieldStack}>
              <ZomatoFormField
                label={t("profile.hourlyRateLabel")}
                value={hourlyRate}
                onChangeText={setHourlyRate}
                placeholder={t("profile.hourlyRatePlaceholder")}
                keyboardType="numeric"
              />
              <ZomatoFormField
                label={t("profile.bioLabel")}
                value={bio}
                onChangeText={setBio}
                placeholder={t("profile.bioPlaceholder")}
                multiline
              />
              <Pressable
                onPress={() =>
                  openShellSurface(navigation, { surfaceId: "professionalProfile" })
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

      <SectionHeader
        label={t("profile.publicLinksSection", { defaultValue: "Public links" })}
      />
      <Card variant="outlined" padding="md" style={styles.sectionCard}>
        <Text style={[styles.publicLinksHint, { color: c.textMuted }]}>
          {t("profile.publicLinksHint", {
            defaultValue:
              "Instagram, Facebook, and your website appear on your profile. Anyone viewing you can tap to open them.",
          })}
        </Text>
        <View style={styles.fieldStack}>
          <ZomatoFormField
            label={t("profile.instagramLabel", { defaultValue: "Instagram" })}
            value={instagram}
            onChangeText={setInstagram}
            placeholder={t("profile.instagramPlaceholder", {
              defaultValue: "instagram.com/you or @handle",
            })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <ZomatoFormField
            label={t("profile.facebookLabel", { defaultValue: "Facebook" })}
            value={facebook}
            onChangeText={setFacebook}
            placeholder={t("profile.facebookPlaceholder", {
              defaultValue: "facebook.com/you",
            })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <ZomatoFormField
            label={t("profile.websiteLabel", { defaultValue: "Website" })}
            value={website}
            onChangeText={setWebsite}
            placeholder={t("profile.websitePlaceholder", {
              defaultValue: "yoursite.com",
            })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
      </Card>

      {!isTrainer && (
        <>
          <SectionHeader label={t("profile.aboutSection", { defaultValue: "About you" })} />
          <Card variant="outlined" padding="md" style={styles.sectionCard}>
            <ZomatoFormField
              label={t("profile.bioLabel")}
              value={bio}
              onChangeText={setBio}
              placeholder={t("profile.bioPlaceholder")}
              multiline
            />
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
        style={{
          backgroundColor: "#3D3D4D",
          borderRadius: radii.md,
          marginTop: space.md,
          marginBottom: space.lg,
          borderWidth: 0,
        }}
      />
    </ScreenContainer>
  );
}


