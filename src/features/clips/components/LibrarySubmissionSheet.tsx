import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { createLibrarySubmission, fetchClipTaxonomy, type LockerClip } from "../api/clipsApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { queryKeys } from "../../../lib/queryKeys";
import { colors, radii, space } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

type Props = {
  visible: boolean;
  clip: LockerClip | null;
  onClose: () => void;
  onSubmitted: () => void;
};

export function LibrarySubmissionSheet({ visible, clip, onClose, onSubmitted }: Props) {
  const { t } = useAppTranslation();
  const { user, accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const profileCategory = useMemo(() => {
    const c = user?.category ?? (user as any)?.Category;
    return typeof c === "string" ? c.trim() : "";
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
      (c) => c.name.toLowerCase() === profileCategory.toLowerCase()
    );
    if (match) setCategoryId(match.id);
  }, [visible, taxonomy, isTrainer, profileCategory]);

  const selectedCategory = taxonomy?.categories.find((c) => c.id === categoryId);
  const subcategories = selectedCategory?.subcategories ?? [];

  const submission = clip?.librarySubmission;
  const canRequest =
    !submission ||
    submission.status === "rejected";

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
      <View style={styles.header}>
        <Text style={styles.title}>{t("locker.libraryRequestTitle")}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lead}>{t("locker.libraryRequestLead")}</Text>

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
          <>
            {isLoading ? (
              <ActivityIndicator color={colors.brandNavy} style={{ marginVertical: space.md }} />
            ) : (
              <>
                {!isTrainer && (
                  <>
                    <Text style={styles.label}>{t("locker.sportCategory")}</Text>
                    <View style={styles.chips}>
                      {(taxonomy?.categories ?? []).map((c) => (
                        <Pressable
                          key={c.id}
                          style={[styles.chip, categoryId === c.id && styles.chipOn]}
                          onPress={() => {
                            setCategoryId(c.id);
                            setSubcategoryId("");
                          }}
                        >
                          <Text style={[styles.chipText, categoryId === c.id && styles.chipTextOn]}>
                            {c.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
                {isTrainer && profileCategory ? (
                  <Text style={styles.muted}>
                    {t("locker.sportFromProfile")}: {profileCategory}
                  </Text>
                ) : null}
                <Text style={styles.label}>{t("locker.subcategory")}</Text>
                <View style={styles.chips}>
                  {subcategories.map((s) => (
                    <Pressable
                      key={s.id}
                      style={[styles.chip, subcategoryId === s.id && styles.chipOn]}
                      onPress={() => setSubcategoryId(s.id)}
                    >
                      <Text style={[styles.chipText, subcategoryId === s.id && styles.chipTextOn]}>
                        {s.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <Pressable
              style={[styles.submitBtn, (!categoryId || !subcategoryId || busy) && styles.submitDisabled]}
              onPress={() => void submit()}
              disabled={!categoryId || !subcategoryId || busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.brandTextOn} />
              ) : (
                <Text style={styles.submitText}>{t("locker.libraryRequestSubmit")}</Text>
              )}
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, flex: 1 },
  body: { padding: space.lg, paddingBottom: 40 },
  lead: { color: colors.textMuted, marginBottom: space.md, lineHeight: 20 },
  label: { fontWeight: "600", color: colors.text, marginTop: space.md, marginBottom: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.brandSubtle, borderColor: colors.brandNavy },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextOn: { color: colors.brandNavy, fontWeight: "600" },
  submitBtn: {
    marginTop: space.lg,
    backgroundColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.brandTextOn, fontWeight: "700" },
  statusBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.md,
  },
  statusLabel: { color: colors.textMuted, fontSize: 12 },
  statusValue: { color: colors.text, fontWeight: "700", marginTop: 4 },
  rejectBox: {
    backgroundColor: "#fef2f2",
    borderRadius: radii.md,
    padding: space.md,
    marginBottom: space.md,
  },
  rejectTitle: { fontWeight: "700", color: "#b91c1c", marginBottom: 4 },
  reason: { color: colors.text, lineHeight: 20 },
  muted: { color: colors.textMuted, marginBottom: space.sm },
});
