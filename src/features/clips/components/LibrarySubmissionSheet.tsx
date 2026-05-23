import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { createLibrarySubmission, fetchClipTaxonomy, type LockerClip } from "../api/clipsApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { queryKeys } from "../../../lib/queryKeys";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

type Props = {
  visible: boolean;
  clip: LockerClip | null;
  onClose: () => void;
  onSubmitted: () => void;
};

export function LibrarySubmissionSheet({ visible, clip, onClose, onSubmitted }: Props) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useStyles();
  const { user, accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const profileCategory = useMemo(() => {
    const cat = user?.category ?? (user as any)?.Category;
    return typeof cat === "string" ? cat.trim() : "";
  }, [user]);

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: taxonomy, isLoading } = useQuery({
    queryKey: queryKeys.clips.taxonomy,
    queryFn: fetchClipTaxonomy,
    enabled: visible,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!visible) {
      setCategoryId("");
      setSubcategoryId("");
      setBusy(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !taxonomy || !isTrainer || !profileCategory) return;
    const match = taxonomy.categories.find(
      (cat) => cat.name.toLowerCase() === profileCategory.toLowerCase()
    );
    if (match) setCategoryId(match.id);
  }, [visible, taxonomy, isTrainer, profileCategory]);

  const selectedCategory = taxonomy?.categories.find((cat) => cat.id === categoryId);
  const subcategories = selectedCategory?.subcategories ?? [];

  const submission = clip?.librarySubmission;
  const canRequest = !submission || submission.status === "rejected";

  const clipTitle = String(clip?.title ?? clip?.file_name ?? t("locker.clipDefault"));

  const submit = async () => {
    if (!clip?._id || !categoryId || !subcategoryId) return;
    setBusy(true);
    try {
      await createLibrarySubmission({
        source_clip_id: String(clip._id),
        proposed_category_id: categoryId,
        proposed_subcategory_id: subcategoryId,
      });
      Alert.alert(t("locker.libraryRequestSentTitle"), t("locker.libraryRequestSentBody"));
      onSubmitted();
      onClose();
    } catch (e) {
      Alert.alert(t("common.error"), getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "submitted":
        return t("locker.libraryStatusSubmitted");
      case "under_review":
        return t("locker.libraryStatusUnderReview");
      case "accepted":
        return t("locker.libraryStatusAccepted");
      case "rejected":
        return t("locker.libraryStatusRejected");
      default:
        return status;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, space.md) }]}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("locker.libraryRequestTitle")}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {clipTitle}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroCard}>
            <Ionicons name="library-outline" size={28} color={c.brandNavy} />
            <Text style={styles.lead}>{t("locker.libraryRequestLead")}</Text>
          </View>

          {submission && submission.status !== "rejected" ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>{t("locker.libraryRequestStatus")}</Text>
              <Text style={styles.statusValue}>{statusLabel(submission.status)}</Text>
              {submission.rejection_reason ? (
                <Text style={styles.reason}>{submission.rejection_reason}</Text>
              ) : null}
            </View>
          ) : null}

          {submission?.status === "rejected" && submission.rejection_reason ? (
            <View style={styles.rejectBox}>
              <Text style={styles.rejectTitle}>{t("locker.libraryRejectionTitle")}</Text>
              <Text style={styles.reason}>{submission.rejection_reason}</Text>
            </View>
          ) : null}

          {canRequest ? (
            <View style={styles.formCard}>
              {isLoading ? (
                <ActivityIndicator color={c.brandNavy} style={{ marginVertical: space.md }} />
              ) : (
                <>
                  {!isTrainer && (
                    <>
                      <Text style={styles.label}>{t("locker.sportCategory")}</Text>
                      <View style={styles.chips}>
                        {(taxonomy?.categories ?? []).map((cat) => (
                          <Pressable
                            key={cat.id}
                            style={[styles.chip, categoryId === cat.id && styles.chipOn]}
                            onPress={() => {
                              setCategoryId(cat.id);
                              setSubcategoryId("");
                            }}
                          >
                            <Text
                              style={[styles.chipText, categoryId === cat.id && styles.chipTextOn]}
                            >
                              {cat.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
                  {isTrainer && profileCategory ? (
                    <View style={styles.profileRow}>
                      <Text style={styles.label}>{t("locker.sportFromProfile")}</Text>
                      <Text style={styles.profileValue}>{profileCategory}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.label}>{t("locker.subcategory")}</Text>
                  {subcategories.length === 0 ? (
                    <Text style={styles.muted}>{t("locker.selectCategoryFirst")}</Text>
                  ) : (
                    <View style={styles.chips}>
                      {subcategories.map((s) => (
                        <Pressable
                          key={s.id}
                          style={[styles.chip, subcategoryId === s.id && styles.chipOn]}
                          onPress={() => setSubcategoryId(s.id)}
                        >
                          <Text
                            style={[styles.chipText, subcategoryId === s.id && styles.chipTextOn]}
                          >
                            {s.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          ) : null}
        </ScrollView>

        {canRequest ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
            <Pressable
              style={[
                styles.submitBtn,
                (!categoryId || !subcategoryId || busy) && styles.submitDisabled,
              ]}
              onPress={() => void submit()}
              disabled={!categoryId || !subcategoryId || busy}
            >
              {busy ? (
                <ActivityIndicator color={c.brandTextOn} />
              ) : (
                <Text style={styles.submitText}>{t("locker.libraryRequestSubmit")}</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      flex: { flex: 1, backgroundColor: palette.background },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      headerText: { flex: 1, minWidth: 0 },
      title: { ...typography.titleSm, color: palette.text, fontWeight: "700" },
      subtitle: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      body: { padding: space.lg, gap: space.md },
      heroCard: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
        gap: space.sm,
        alignItems: "flex-start",
      },
      lead: { ...typography.bodySm, color: palette.textMuted, lineHeight: 20 },
      formCard: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
        gap: space.sm,
      },
      label: { ...typography.caption, fontWeight: "700", color: palette.text, marginTop: space.xs },
      chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
      chip: {
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radii.pill,
        backgroundColor: palette.background,
        borderWidth: 1,
        borderColor: palette.border,
      },
      chipOn: { backgroundColor: palette.brandSubtle, borderColor: palette.brandNavy },
      chipText: { ...typography.caption, color: palette.textMuted, fontWeight: "600" },
      chipTextOn: { color: palette.brandNavy },
      profileRow: { gap: 4, marginBottom: space.xs },
      profileValue: { ...typography.bodyMd, color: palette.text, fontWeight: "600" },
      muted: { ...typography.caption, color: palette.textMuted },
      footer: {
        paddingHorizontal: space.lg,
        paddingTop: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
        backgroundColor: palette.surfaceElevated,
      },
      submitBtn: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: "center",
      },
      submitDisabled: { opacity: 0.5 },
      submitText: { ...typography.bodyMd, color: palette.brandTextOn, fontWeight: "700" },
      statusBox: {
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      statusLabel: { ...typography.caption, color: palette.textMuted },
      statusValue: { ...typography.bodyMd, color: palette.text, fontWeight: "700", marginTop: 4 },
      rejectBox: {
        backgroundColor: "#fef2f2",
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: "#fecaca",
      },
      rejectTitle: { fontWeight: "700", color: "#b91c1c", marginBottom: 4 },
      reason: { ...typography.bodySm, color: palette.text, lineHeight: 20 },
    })
  );
}
