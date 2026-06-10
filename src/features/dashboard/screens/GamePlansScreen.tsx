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
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return `${m}/${d}/${y}`;
  }
}

export function GamePlansScreen() {
  const { t } = useAppTranslation();
  const { user, accountType } = useAuth();
  const myId = String(user?._id ?? "");
  const c = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const planThumbWidth = Math.max(140, windowWidth - space.md * 4);

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      section: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
        gap: space.sm,
      },
      sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
      sectionTitle: { ...typography.subtitle, color: palette.brandNavy, fontWeight: "700" },
      planCard: {
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.sm,
        backgroundColor: palette.surface,
      },
      planPh: {
        height: 120,
        borderRadius: radii.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.brandSubtle,
      },
      planTitle: { ...typography.bodyMd, fontWeight: "600", color: palette.text, marginTop: 8 },
      planHint: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
      badgeRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
      badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        backgroundColor: palette.surfaceMuted,
      },
      badgeText: { ...typography.caption, color: palette.textMuted, fontSize: 11 },
      editBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 8,
        alignSelf: "flex-start",
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceMuted,
      },
      editBtnText: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
    })
  );

  const reportsQ = useQuery({
    queryKey: queryKeys.locker.reports,
    queryFn: () => postReportsGetAll({}),
    staleTime: 30_000,
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
    const reportsFallback = t("gamePlans.reportsFallback");
    const isTrainee = accountType === AccountType.TRAINEE;

    return rows
      .map((grp: { _id?: { month?: number; day?: number; year?: number }; report?: unknown[] }) => {
        const data = ((grp.report ?? []) as Record<string, unknown>[]).filter((item) => {
          if (!myId) return true;
          const trainerId = String(
            (item.trainer as { _id?: string })?._id ?? item.trainer ?? ""
          );
          const traineeId = String(
            (item.trainee as { _id?: string })?._id ?? item.trainee ?? ""
          );
          if (isTrainee) return traineeId === myId;
          return trainerId === myId;
        });
        return {
          title: formatReportDate(grp._id, reportsFallback),
          data,
        };
      })
      .filter((section) => section.data.length > 0);
  }, [reportsQ.data, t, accountType, myId]);

  const openPlan = (item: Record<string, unknown>) => {
    const reportData = (item.reportData as { imageUrl?: string; title?: string }[] | undefined)?.[0];
    const img = reportData?.imageUrl;
    const title = reportData?.title ?? String(item.title ?? t("gamePlans.planDefault"));
    const session = item.session as { report?: string; sessionRecordingUrl?: string } | undefined;
    const pdfName = session?.report;
    const recording =
      session?.sessionRecordingUrl ?? (item.sessionRecordingUrl as string | undefined);

    const fromImg = img ? getS3ImageUrl(img) : "";
    const fromPdf = pdfName ? getS3ImageUrl(pdfName) : "";
    const fromRec =
      typeof recording === "string" && recording.length > 0 ? getS3ImageUrl(recording) : "";

    const uri = fromPdf || fromImg || fromRec;
    if (!uri) {
      Alert.alert(
        t("gamePlans.nothingToPreviewTitle"),
        t("gamePlans.nothingToPreviewBody")
      );
      return;
    }

    let mode: LockerViewerMode;
    if (fromImg && !isLikelyPdf(fromImg)) mode = "image";
    else if (fromPdf || isLikelyPdf(uri)) mode = "pdf";
    else mode = "video";
    setViewer({ uri, title, mode });
  };

  const onRefresh = useCallback(() => {
    void reportsQ.refetch();
  }, [reportsQ]);

  const planKind = (item: Record<string, unknown>) => {
    const reportData = (item.reportData as { imageUrl?: string }[] | undefined)?.[0];
    const session = item.session as { report?: string; sessionRecordingUrl?: string } | undefined;
    if (reportData?.imageUrl) return "image";
    if (session?.report) return "pdf";
    if (session?.sessionRecordingUrl || item.sessionRecordingUrl) {
      const rec = String(session?.sessionRecordingUrl ?? item.sessionRecordingUrl ?? "");
      return isLikelyAudio(rec) ? "audio" : "video";
    }
    return "none";
  };

  return (
    <>
      <LockerListShell
        loading={reportsQ.isLoading}
        isError={reportsQ.isError}
        error={reportsQ.error}
        onRetry={() => void reportsQ.refetch()}
        refreshing={reportsQ.isRefetching}
        onRefresh={onRefresh}
        renderSkeletonRow={() => <GamePlanCardSkeleton />}
      >
        {reportSections.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={t("gamePlans.emptyTitle")}
            description={t("gamePlans.emptyDescription")}
          />
        ) : (
          reportSections.map((section, si) => (
            <View key={`${section.title}-${si}`} style={styles.section}>
              <View style={styles.sectionHead}>
                <Ionicons name="calendar-outline" size={18} color={c.iconPrimary} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              {section.data.map((item, index) => {
                const reportData = (item.reportData as { imageUrl?: string; title?: string }[] | undefined)?.[0];
                const title = reportData?.title ?? String(item.title ?? t("gamePlans.planDefault"));
                const uri = reportData?.imageUrl ? getS3ImageUrl(reportData.imageUrl) : "";
                const kind = planKind(item);
                const sessionId = String(
                  item.sessions ??
                    (item.session as { _id?: string } | undefined)?._id ??
                    ""
                );
                const trainerId = String(
                  (item.trainer as { _id?: string })?._id ?? item.trainer ?? ""
                );
                const traineeId = String(
                  (item.trainee as { _id?: string })?._id ?? item.trainee ?? ""
                );
                const traineeLabel = String(
                  (item.trainee as { fullname?: string; fullName?: string })?.fullname ??
                    (item.trainee as { fullName?: string })?.fullName ??
                    ""
                );
                const canEdit =
                  accountType !== AccountType.TRAINEE &&
                  !!sessionId &&
                  !!trainerId &&
                  !!traineeId;

                return (
                  <Pressable
                    key={`plan-${String(item._id ?? "row")}-${index}`}
                    style={styles.planCard}
                    onPress={() => openPlan(item)}
                  >
                    {uri ? (
                      <ImageWithSkeleton
                        uri={uri}
                        width={planThumbWidth}
                        height={120}
                        borderRadius={radii.sm}
                        resizeMode="cover"
                        accessibilityLabel={title}
                      />
                    ) : (
                      <View style={[styles.planPh, { width: planThumbWidth }]}>
                        <Ionicons
                          name={
                            kind === "pdf"
                              ? "document-text-outline"
                              : kind === "video"
                                ? "videocam-outline"
                                : "document-outline"
                          }
                          size={32}
                          color={c.brandAccent}
                        />
                      </View>
                    )}
                    <Text style={styles.planTitle} numberOfLines={2}>
                      {title}
                    </Text>
                    {canEdit ? (
                      <Pressable
                        style={styles.editBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setEditPlan({
                            sessionId,
                            trainerId,
                            traineeId,
                            traineeName: traineeLabel || undefined,
                          });
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="create-outline" size={18} color={c.brandNavy} />
                        <Text style={styles.editBtnText}>{t("gamePlans.edit", "Edit plan")}</Text>
                      </Pressable>
                    ) : null}
                    <View style={styles.badgeRow}>
                      {kind !== "none" ? (
                        <View style={styles.badge}>
                          <Ionicons
                            name={
                              kind === "pdf"
                                ? "document-outline"
                                : kind === "video"
                                  ? "play-outline"
                                  : "image-outline"
                            }
                            size={12}
                            color={c.textMuted}
                          />
                          <Text style={styles.badgeText}>
                            {kind === "pdf"
                              ? t("gamePlans.badgePdf")
                              : kind === "video"
                                ? t("gamePlans.badgeRecording")
                                : t("gamePlans.badgeImage")}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={styles.planHint}>{t("gamePlans.tapToPreview")}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
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
