import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { WebView } from "react-native-webview";
import {
  Banner,
  Button,
  Card,
  FormField,
  ScreenContainer,
  ScreenLoadingState,
} from "../../../components/ui";
import { ProfileAvatar } from "../../../components/ui/ProfileAvatar";
import { AuthEscapeLink } from "../../auth/components/AuthEscapeLink";
import { fetchSportCategories } from "../../auth/api/masterApi";
import { useAuth } from "../../auth/context/AuthContext";
import { apiClient } from "../../../api/client";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { VerificationProgressHeader } from "../components/VerificationProgressHeader";
import {
  completeFaceLiveness,
  createFaceLivenessSession,
  updateVerificationProfile,
} from "../verificationApi";

type Props = { onDone: () => void };

type FaceSession = {
  sessionId: string;
  region?: string;
  mock?: boolean;
};

export function ProfileFaceScreen({ onDone }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const { user, refreshUser } = useAuth();

  const [category, setCategory] = useState(String(user?.category ?? ""));
  const [bio, setBio] = useState(String((user as { bio?: string })?.bio ?? ""));
  const [profilePicture, setProfilePicture] = useState(
    String((user as { profile_picture?: string })?.profile_picture ?? "")
  );
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [faceSession, setFaceSession] = useState<FaceSession | null>(null);
  const [faceBusy, setFaceBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["sportCategories"],
    queryFn: fetchSportCategories,
    staleTime: 300_000,
  });

  const displayName = String(user?.fullname ?? user?.fullName ?? t("profile.userDefault"));

  const pickAndUploadAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("profile.permissionTitle"), t("profile.permissionLibrary"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? "image/jpeg";
    setAvatarUploading(true);
    setLocalAvatar(asset.uri);
    setError(null);
    try {
      const signRes = await apiClient.put("/common/update-profile-picture", {
        fileType: mimeType,
      });
      const presignedUrl: string | undefined =
        signRes.data?.url ?? signRes.data?.data?.url;
      if (!presignedUrl) throw new Error("Server did not return an upload URL.");

      const imageRes = await fetch(asset.uri);
      const blob = await imageRes.blob();
      const s3Res = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });
      if (!s3Res.ok) throw new Error(`Upload failed (${s3Res.status})`);

      await refreshUser();
      const refreshedPic = String(
        (user as { profile_picture?: string })?.profile_picture ?? ""
      );
      if (refreshedPic) setProfilePicture(refreshedPic);
      setLocalAvatar(null);
    } catch (e) {
      setLocalAvatar(null);
      setError(getApiErrorMessage(e, t("profile.uploadFailedBody")));
    } finally {
      setAvatarUploading(false);
    }
  }, [refreshUser, t, user]);

  const saveProfile = useCallback(async () => {
    if (!category.trim()) {
      setError(t("verification.profileCategoryRequired", { defaultValue: "Choose your coaching category." }));
      return;
    }
    if (!profilePicture.trim() && !localAvatar) {
      setError(t("verification.profilePhotoRequired", { defaultValue: "Add a profile photo before continuing." }));
      return;
    }
    setProfileSaving(true);
    setError(null);
    try {
      await updateVerificationProfile({
        category: category.trim(),
        bio: bio.trim(),
        profile_picture: profilePicture.trim() || undefined,
        extraInfo: { bio: bio.trim() },
      });
      await refreshUser();
      setProfileSaved(true);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setProfileSaving(false);
    }
  }, [bio, category, localAvatar, profilePicture, refreshUser, t]);

  const startLiveness = useCallback(async () => {
    setFaceBusy(true);
    setError(null);
    try {
      const session = await createFaceLivenessSession();
      setFaceSession({
        sessionId: String(session.sessionId),
        region: session.region,
        mock: Boolean(session.mock),
      });
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setFaceBusy(false);
    }
  }, []);

  const submitForReview = useCallback(async () => {
    if (!profileSaved) {
      await saveProfile();
    }
    if (!faceSession?.sessionId) {
      setError(
        t("verification.livenessRequired", {
          defaultValue: "Complete the face verification check before submitting.",
        })
      );
      return;
    }
    setSubmitBusy(true);
    setError(null);
    try {
      await completeFaceLiveness(faceSession.sessionId);
      onDone();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setSubmitBusy(false);
    }
  }, [faceSession?.sessionId, onDone, profileSaved, saveProfile, t]);

  useEffect(() => {
    if (profilePicture || localAvatar) return;
    const pic = String((user as { profile_picture?: string })?.profile_picture ?? "");
    if (pic) setProfilePicture(pic);
  }, [localAvatar, profilePicture, user]);

  const livenessUrl = useMemo(() => {
    if (!faceSession || faceSession.mock) return null;
    const region = faceSession.region || "us-east-1";
    return `https://face-liveness.aws.amazon.com/liveness?sessionId=${encodeURIComponent(
      faceSession.sessionId
    )}&region=${encodeURIComponent(region)}`;
  }, [faceSession]);

  if (catsLoading) {
    return <ScreenLoadingState variant="fullscreen" />;
  }

  return (
    <ScreenContainer scroll applyTopInset padding="lg" background={c.background}>
      <AuthEscapeLink variant="signout" />

      <VerificationProgressHeader
        phase={2}
        phaseTotal={3}
        title={t("verification.profileFaceTitle", { defaultValue: "Profile & identity check" })}
        subtitle={t("verification.profileFaceSubtitle", {
          defaultValue: "Add your coaching profile, then complete a quick liveness check.",
        })}
        steps={[
          { key: "profile", label: "Profile", done: profileSaved, active: !profileSaved },
          {
            key: "face",
            label: "Face check",
            done: Boolean(faceSession),
            active: profileSaved && !faceSession,
          },
          { key: "submit", label: "Submit", done: false, active: Boolean(faceSession) },
        ]}
      />

      {error ? <Banner tone="danger" title={error} /> : null}

      <Card variant="outlined" padding="md" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          {t("verification.profileSection", { defaultValue: "Your coach profile" })}
        </Text>

        <Pressable
          onPress={() => void pickAndUploadAvatar()}
          disabled={avatarUploading}
          style={styles.avatarRow}
        >
          <ProfileAvatar
            uri={localAvatar ?? undefined}
            user={localAvatar ? undefined : (user as Record<string, unknown>)}
            name={displayName}
            size={88}
          />
          <View style={styles.avatarCopy}>
            <Text style={[styles.avatarLabel, { color: c.text }]}>
              {t("profile.changePhoto")}
            </Text>
            <Text style={[styles.avatarHint, { color: c.textMuted }]}>
              {t("verification.profilePhotoHint", {
                defaultValue: "Use a clear headshot. This is shown to trainees.",
              })}
            </Text>
            {avatarUploading ? <ActivityIndicator color={c.brandNavy} /> : null}
          </View>
        </Pressable>

        <Text style={[styles.fieldLabel, { color: c.text }]}>
          {t("verification.categoryLabel", { defaultValue: "Coaching category" })}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: active ? c.brandNavy : c.surfaceElevated,
                    borderColor: active ? c.brandNavy : c.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.catChipText,
                    { color: active ? c.brandTextOn : c.text },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <FormField
          label={t("profile.bioLabel")}
          value={bio}
          onChangeText={setBio}
          placeholder={t("profile.bioPlaceholder")}
          multiline
          inputStyle={{ minHeight: 96, textAlignVertical: "top" }}
        />

        <Button
          label={
            profileSaving
              ? t("common.saving", { defaultValue: "Saving..." })
              : t("verification.saveProfile", { defaultValue: "Save profile" })
          }
          variant="secondary"
          loading={profileSaving}
          onPress={() => void saveProfile()}
        />
      </Card>

      <Card variant="outlined" padding="md" style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>
          {t("verification.livenessTitle", { defaultValue: "Face liveness check" })}
        </Text>
        <Text style={[styles.body, { color: c.textMuted }]}>
          {t("verification.livenessBody", {
            defaultValue:
              "Remove masks and sunglasses, use good lighting, and follow the on-screen prompts.",
          })}
        </Text>

        {!faceSession ? (
          <Button
            label={t("verification.startLiveness", { defaultValue: "Start face check" })}
            leftIcon="scan-outline"
            loading={faceBusy}
            disabled={!profileSaved && !category}
            onPress={() => void startLiveness()}
          />
        ) : faceSession.mock ? (
          <Banner
            tone="info"
            title={t("verification.mockLivenessTitle", { defaultValue: "Development check" })}
            description={t("verification.mockLivenessBody", {
              defaultValue: "Mock liveness session started. Submit when ready.",
            })}
          />
        ) : livenessUrl ? (
          <View style={styles.webviewWrap}>
            <WebView
              source={{ uri: livenessUrl }}
              style={styles.webview}
              mediaPlaybackRequiresUserAction
              allowsInlineMediaPlayback
            />
          </View>
        ) : null}

        {faceSession ? (
          <Button
            label={t("verification.submitForReview", { defaultValue: "Submit for review" })}
            leftIcon="shield-checkmark-outline"
            loading={submitBusy}
            onPress={() => void submitForReview()}
            size="lg"
          />
        ) : null}
      </Card>
    </ScreenContainer>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      section: { marginBottom: space.md },
      sectionTitle: { ...typography.subtitle, fontWeight: "800", marginBottom: space.sm },
      avatarRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.md },
      avatarCopy: { flex: 1, gap: 4 },
      avatarLabel: { ...typography.label, fontWeight: "700" },
      avatarHint: { ...typography.caption, lineHeight: 18 },
      fieldLabel: { ...typography.label, marginBottom: space.xs, fontWeight: "700" },
      catScroll: { marginBottom: space.md },
      catChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        borderWidth: 1,
        marginRight: space.xs,
      },
      catChipText: { ...typography.caption, fontWeight: "700" },
      body: { ...typography.bodySm, lineHeight: 20, marginBottom: space.sm },
      webviewWrap: {
        height: 360,
        borderRadius: radii.md,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: palette.border,
        marginBottom: space.sm,
      },
      webview: { flex: 1, backgroundColor: palette.surface },
    })
  );
}
