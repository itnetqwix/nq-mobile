import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, GamePlanCardSkeleton, ImageWithSkeleton } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { isLikelyAudio, isLikelyPdf } from "../../../lib/clipMediaUrl";
import { postReportsGetAll } from "../../home/api/homeApi";
import { LockerListShell } from "../components/locker/LockerListShell";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";
import { SessionGamePlanModal } from "../../calling/components/SessionGamePlanModal";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { queryKeys } from "../../../lib/queryKeys";

const HERO_HEIGHT = 110;

function formatReportDate(
  id: { month?: number; day?: number; year?: number } | null | undefined,
  reportsFallback: string
): string {
  if (!id?.year) return reportsFallback;
  const m = id.month ?? 1;
  const d = id.day ?? 1;
  const y = id.year;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return `${m}/${d}/${y}`;
  }
}

type KindType = "image" | "pdf" | "video" | "audio" | "none";

const KIND_META: Record<
  KindType,
  { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bg: string }
> = {
  image:  { icon: "image-outline",         label: "Image",     color: "#16a34a", bg: "#f0fdf4" },
  pdf:    { icon: "document-text-outline",  label: "PDF",       color: "#d97706", bg: "#fffbeb" },
  video:  { icon: "videocam-outline",       label: "Recording", color: "#2563eb", bg: "#eff6ff" },
  audio:  { icon: "musical-notes-outline",  label: "Audio",     color: "#7c3aed", bg: "#f5f3ff" },
  none:   { icon: "document-outline",       label: "Plan",      color: "#6b7280", bg: "#f3f4f6" },
};

function formatLessonDate(raw: unknown): string | null {
  if (!raw) return null;
  try {
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function formatRelativeUpdated(raw: unknown): string | null {
  if (!raw) return null;
  try {
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) return null;
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "Updated just now";
    if (mins < 60) return `Updated ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) return `Updated ${hrs}h ago`;
    return `Updated ${d.toLocaleDateString()}`;
  } catch {
    return null;
  }
}

type SessionPlanMeta = {
  report?: string;
  sessionRecordingUrl?: string;
  start_time?: string;
  game_plan_pdf_status?: "idle" | "pending" | "ready" | "failed";
  game_plan_pdf_version?: number;
};

export function GamePlansScreen() {
  const { t } = useAppTranslation();
  const { user, accountType } = useAuth();
  const myId = String(user?._id ?? "");
  const c = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = windowWidth - space.md * 2;
  const isTrainer = accountType !== AccountType.TRAINEE;

  const styles = useStyles();

  const reportsQ = useQuery({
    queryKey: queryKeys.locker.reports,
    queryFn: () => postReportsGetAll({}),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      const hasPending = rows.some((grp: { report?: Record<string, unknown>[] }) =>
        (grp.report ?? []).some((item) => {
          const session = item.session as SessionPlanMeta | undefined;
          return session?.game_plan_pdf_status === "pending";
        })
      );
      return hasPending ? 5000 : false;
    },
  });

  const [viewer, setViewer] = useState<{
    uri: string;
    title: string;
    mode: LockerViewerMode;
  } | null>(null);

  const [editPlan, setEditPlan] = useState<{
    sessionId: string;
    trainerId: string;
    traineeId: string;
    traineeName?: string;
  } | null>(null);

  const reportSections = useMemo(() => {
    const rows = reportsQ.data ?? [];
    const reportsFallback = t("gamePlans.reportsFallback", { defaultValue: "Session" });

    return rows
      .map((grp: { _id?: { month?: number; day?: number; year?: number }; report?: unknown[] }) => {
        const data = ((grp.report ?? []) as Record<string, unknown>[]).filter((item) => {
          if (!myId) return true;
          const trainerId = String((item.trainer as { _id?: string })?._id ?? item.trainer ?? "");
          const traineeId = String((item.trainee as { _id?: string })?._id ?? item.trainee ?? "");
          if (!isTrainer) return traineeId === myId;
          return trainerId === myId;
        });
        return {
          date: formatReportDate(grp._id, reportsFallback),
          data,
        };
      })
      .filter((s) => s.data.length > 0);
  }, [reportsQ.data, t, isTrainer, myId]);

  const openPlan = (item: Record<string, unknown>) => {
    const reportData = (item.reportData as { imageUrl?: string; title?: string }[] | undefined)?.[0];
    const img = reportData?.imageUrl;
    const title = reportData?.title ?? String(item.title ?? t("gamePlans.planDefault", { defaultValue: "Game Plan" }));
    const session = item.session as SessionPlanMeta | undefined;
    const pdfName = session?.report;
    const pdfVersion = session?.game_plan_pdf_version;
    const recording = session?.sessionRecordingUrl ?? (item.sessionRecordingUrl as string | undefined);

    const fromImg = img ? getS3ImageUrl(img) : "";
    const fromPdf = pdfName
      ? `${getS3ImageUrl(pdfName)}${pdfVersion ? `?v=${pdfVersion}` : ""}`
      : "";
    const fromRec = typeof recording === "string" && recording.length > 0 ? getS3ImageUrl(recording) : "";

    const uri = fromPdf || fromImg || fromRec;
    if (!uri) {
      Alert.alert(t("gamePlans.nothingToPreviewTitle"), t("gamePlans.nothingToPreviewBody"));
      return;
    }

    let mode: LockerViewerMode;
    if (fromImg && !isLikelyPdf(fromImg)) mode = "image";
    else if (fromPdf || isLikelyPdf(uri)) mode = "pdf";
    else mode = "video";
    setViewer({ uri, title, mode });
  };

  const onRefresh = useCallback(() => { void reportsQ.refetch(); }, [reportsQ]);

  const planKind = (item: Record<string, unknown>): KindType => {
    const reportData = (item.reportData as { imageUrl?: string }[] | undefined)?.[0];
    const session = item.session as { report?: string; sessionRecordingUrl?: string } | undefined;
    if (session?.report) return "pdf";
    if (reportData?.imageUrl) return "image";
    if (session?.sessionRecordingUrl || item.sessionRecordingUrl) {
      const rec = String(session?.sessionRecordingUrl ?? item.sessionRecordingUrl ?? "");
      return isLikelyAudio(rec) ? "audio" : "video";
    }
    return "none";
  };

  const totalPlans = reportSections.reduce((n, s) => n + s.data.length, 0);

  return (
    <>
      <LockerListShell
        loading={reportsQ.isLoading}
        isError={reportsQ.isError}
        error={reportsQ.error}
        onRetry={() => void reportsQ.refetch()}
        refreshing={reportsQ.isRefetching}
        onRefresh={onRefresh}
        applyTopSafeArea={false}
        renderSkeletonRow={() => <GamePlanCardSkeleton />}
      >
        {reportSections.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={t("gamePlans.emptyTitle")}
            description={t("gamePlans.emptyDescription")}
          />
        ) : (
          <>
            {/* total count header */}
            <View style={styles.listHeader}>
              <Ionicons name="folder-open-outline" size={18} color={c.brandNavy} />
              <Text style={styles.listHeaderText}>
                {t("gamePlans.totalPlans", {
                  defaultValue: "{{count}} game plans",
                  count: totalPlans,
                })}
              </Text>
            </View>

            {reportSections.map((section, si) => (
              <View key={`${section.date}-${si}`} style={styles.section}>
                {/* sticky-feeling date header */}
                <View style={styles.dateHeader}>
                  <View style={styles.dateIconWrap}>
                    <Ionicons name="calendar-outline" size={15} color={c.brandNavy} />
                  </View>
                  <Text style={styles.dateText}>{section.date}</Text>
                  <View style={styles.datePill}>
                    <Text style={styles.datePillText}>{section.data.length}</Text>
                  </View>
                </View>

                <View style={styles.cardsWrap}>
                  {section.data.map((item, index) => {
                    const reportData = (item.reportData as { imageUrl?: string; title?: string }[] | undefined)?.[0];
                    const title = reportData?.title ?? String(item.title ?? t("gamePlans.planDefault", { defaultValue: "Game Plan" }));
                    const session = item.session as SessionPlanMeta | undefined;
                    const hasPdf = !!session?.report;
                    const pdfPending = session?.game_plan_pdf_status === "pending";
                    const pdfFailed = session?.game_plan_pdf_status === "failed";
                    const isDraft = item.publish_status === "draft";
                    const lessonDate = formatLessonDate(session?.start_time ?? item.updatedAt);
                    const updatedLabel = formatRelativeUpdated(item.updatedAt);
                    const trainerLabel = String(
                      (item.trainer as { fullname?: string; fullName?: string })?.fullname ??
                        (item.trainer as { fullName?: string })?.fullName ?? ""
                    );
                    const uri = !hasPdf && reportData?.imageUrl ? getS3ImageUrl(reportData.imageUrl) : "";
                    const kind = planKind(item);
                    const km = KIND_META[kind];

                    const sessionId = String(
                      item.sessions ?? (item.session as { _id?: string } | undefined)?._id ?? ""
                    );
                    const trainerId = String((item.trainer as { _id?: string })?._id ?? item.trainer ?? "");
                    const traineeId = String((item.trainee as { _id?: string })?._id ?? item.trainee ?? "");
                    const traineeLabel = String(
                      (item.trainee as { fullname?: string; fullName?: string })?.fullname ??
                        (item.trainee as { fullName?: string })?.fullName ?? ""
                    );
                    const canEdit = isTrainer && !!sessionId && !!trainerId && !!traineeId;

                    return (
                      <Pressable
                        key={`plan-${String(item._id ?? "row")}-${index}`}
                        style={({ pressed }) => [styles.planCard, pressed && { opacity: 0.94 }]}
                        onPress={() => openPlan(item)}
                        accessibilityRole="button"
                        accessibilityLabel={title}
                      >
                        {/* Hero area */}
                        <View style={styles.heroWrap}>
                          {uri ? (
                            <ImageWithSkeleton
                              uri={uri}
                              width={cardWidth}
                              height={HERO_HEIGHT}
                              borderRadius={radii.md}
                              resizeMode="cover"
                              accessibilityLabel={title}
                            />
                          ) : (
                            <View style={[styles.heroPh, { backgroundColor: km.bg }]}>
                              <Ionicons name={km.icon} size={40} color={km.color} />
                            </View>
                          )}
                          {/* kind badge overlaid on hero */}
                          <View style={[styles.kindBadge, { backgroundColor: km.bg, borderColor: km.color + "44" }]}>
                            <Ionicons name={km.icon} size={11} color={km.color} />
                            <Text style={[styles.kindBadgeText, { color: km.color }]}>
                              {pdfPending ? "Generating PDF" : km.label}
                            </Text>
                          </View>
                          {isTrainer && isDraft ? (
                            <View style={[styles.statusBadge, styles.draftBadge]}>
                              <Text style={styles.draftBadgeText}>Draft</Text>
                            </View>
                          ) : null}
                          {pdfFailed ? (
                            <View style={[styles.statusBadge, styles.failedBadge]}>
                              <Text style={styles.failedBadgeText}>PDF failed</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Content area */}
                        <View style={styles.cardBody}>
                          <Text style={styles.planTitle} numberOfLines={2}>{title}</Text>

                          {lessonDate ? (
                            <View style={styles.metaRow}>
                              <Ionicons name="calendar-outline" size={11} color={c.textMuted} />
                              <Text style={styles.metaText} numberOfLines={1}>{lessonDate}</Text>
                            </View>
                          ) : null}

                          {isTrainer && traineeLabel ? (
                            <View style={styles.traineeTag}>
                              <Ionicons name="person-outline" size={11} color={c.textMuted} />
                              <Text style={styles.traineeTagText} numberOfLines={1}>{traineeLabel}</Text>
                            </View>
                          ) : null}

                          {!isTrainer && trainerLabel ? (
                            <View style={styles.traineeTag}>
                              <Ionicons name="school-outline" size={11} color={c.textMuted} />
                              <Text style={styles.traineeTagText} numberOfLines={1}>{trainerLabel}</Text>
                            </View>
                          ) : null}

                          {updatedLabel ? (
                            <Text style={styles.updatedText}>{updatedLabel}</Text>
                          ) : null}

                          {pdfPending ? (
                            <Text style={styles.pendingText}>
                              {t("gamePlans.pdfGenerating", { defaultValue: "PDF generating…" })}
                            </Text>
                          ) : null}

                          <View style={styles.cardFooter}>
                            {/* Edit button for trainers */}
                            {canEdit ? (
                              <Pressable
                                style={styles.editBtn}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  setEditPlan({ sessionId, trainerId, traineeId, traineeName: traineeLabel || undefined });
                                }}
                                hitSlop={8}
                                accessibilityRole="button"
                              >
                                <Ionicons name="create-outline" size={14} color={c.brandNavy} />
                                <Text style={styles.editBtnText}>{t("gamePlans.edit", { defaultValue: "Edit plan" })}</Text>
                              </Pressable>
                            ) : (
                              <View />
                            )}

                            {/* Preview CTA */}
                            <View style={styles.previewCta}>
                              <Text style={styles.previewCtaText}>{t("gamePlans.tapToPreview", { defaultValue: "Tap to preview" })}</Text>
                              <Ionicons name="arrow-forward" size={13} color={c.brandNavy} />
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}
      </LockerListShell>

      {editPlan ? (
        <SessionGamePlanModal
          visible
          sessionId={editPlan.sessionId}
          trainerId={editPlan.trainerId}
          traineeId={editPlan.traineeId}
          traineeName={editPlan.traineeName}
          lockerEdit
          onClose={() => setEditPlan(null)}
          onSaved={() => {
            setEditPlan(null);
            void reportsQ.refetch();
          }}
        />
      ) : null}

      <LockerViewerModal
        visible={!!viewer}
        onClose={() => setViewer(null)}
        uri={viewer?.uri ?? ""}
        title={viewer?.title}
        mode={viewer?.mode ?? "pdf"}
      />
    </>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      listHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        marginBottom: space.sm,
        paddingHorizontal: 2,
      },
      listHeaderText: {
        ...typography.titleSm,
        color: palette.textMuted,
        fontWeight: "600",
      },
      section: {
        marginBottom: space.md,
      },
      dateHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        marginBottom: space.sm,
        paddingHorizontal: 2,
      },
      dateIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      dateText: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
        flex: 1,
      },
      datePill: {
        backgroundColor: palette.brandNavy,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: radii.pill,
        minWidth: 24,
        alignItems: "center",
      },
      datePillText: {
        color: palette.brandTextOn,
        fontSize: 11,
        fontWeight: "700",
      },
      cardsWrap: {
        gap: space.sm,
      },
      planCard: {
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        overflow: "hidden",
      },
      heroWrap: {
        position: "relative",
      },
      heroPh: {
        height: HERO_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        borderTopLeftRadius: radii.lg,
        borderTopRightRadius: radii.lg,
      },
      kindBadge: {
        position: "absolute",
        top: 8,
        left: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: radii.pill,
        borderWidth: 1,
      },
      kindBadgeText: {
        fontSize: 10,
        fontWeight: "700",
      },
      statusBadge: {
        position: "absolute",
        top: 8,
        right: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
      },
      draftBadge: {
        backgroundColor: "#fff8e6",
        borderWidth: 1,
        borderColor: "#f0c040",
      },
      draftBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#8a6d00",
      },
      failedBadge: {
        backgroundColor: "#fef2f2",
        borderWidth: 1,
        borderColor: "#fca5a5",
      },
      failedBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: "#b91c1c",
      },
      metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
      },
      metaText: {
        fontSize: 11,
        color: palette.textMuted,
        flex: 1,
      },
      updatedText: {
        fontSize: 11,
        color: palette.textMuted,
        marginTop: 4,
      },
      pendingText: {
        fontSize: 11,
        color: palette.brandNavy,
        fontWeight: "600",
        marginTop: 4,
      },
      cardBody: {
        paddingHorizontal: space.sm,
        paddingVertical: space.sm,
        gap: 4,
      },
      planTitle: {
        ...typography.bodySm,
        fontWeight: "700",
        color: palette.text,
        lineHeight: 18,
      },
      traineeTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 2,
      },
      traineeTagText: {
        ...typography.caption,
        color: palette.textMuted,
        flex: 1,
      },
      cardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
      },
      editBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceMuted,
      },
      editBtnText: {
        ...typography.caption,
        color: palette.brandNavy,
        fontWeight: "700",
      },
      previewCta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      },
      previewCtaText: {
        ...typography.caption,
        color: palette.brandNavy,
        fontWeight: "600",
      },
    })
  );
}
