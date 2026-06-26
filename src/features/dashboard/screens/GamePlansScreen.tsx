import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { LockerBrandFooter } from "../components/locker/LockerBrandFooter";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";
import { SessionGamePlanModal } from "../../calling/components/SessionGamePlanModal";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { queryKeys } from "../../../lib/queryKeys";
import { useDebouncedValue, SEARCH_LOCAL_DEBOUNCE_MS } from "../../../lib/timing";

const PLAN_HERO_HEIGHT = 152;
type PlanFilter = "all" | "draft" | "published" | "pending";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const debouncedSearch = useDebouncedValue(searchQuery, SEARCH_LOCAL_DEBOUNCE_MS);

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

  const flatPlans = useMemo(
    () =>
      reportSections.flatMap((section) =>
        section.data.map((item) => ({ item, sectionDate: section.date }))
      ),
    [reportSections]
  );

  const filteredPlans = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return flatPlans.filter(({ item }) => {
      const reportData = (item.reportData as { title?: string }[] | undefined)?.[0];
      const title = String(reportData?.title ?? item.title ?? "");
      if (q && !title.toLowerCase().includes(q)) return false;
      if (!isTrainer || planFilter === "all") return true;
      const session = item.session as SessionPlanMeta | undefined;
      if (planFilter === "draft") return item.publish_status === "draft";
      if (planFilter === "published") return item.publish_status !== "draft";
      if (planFilter === "pending") return session?.game_plan_pdf_status === "pending";
      return true;
    });
  }, [flatPlans, debouncedSearch, isTrainer, planFilter]);

  const filterChips: { id: PlanFilter; label: string }[] = isTrainer
    ? [
        { id: "all", label: t("gamePlans.filterAll", { defaultValue: "All" }) },
        { id: "published", label: t("gamePlans.filterPublished", { defaultValue: "Published" }) },
        { id: "draft", label: t("gamePlans.filterDraft", { defaultValue: "Drafts" }) },
        { id: "pending", label: t("gamePlans.filterPending", { defaultValue: "Generating" }) },
      ]
    : [];

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
        listFooter={<LockerBrandFooter />}
      >
        {reportSections.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={t("gamePlans.emptyTitle")}
            description={t("gamePlans.emptyDescription")}
          />
        ) : (
          <>
            <View style={styles.listHeader}>
              <Ionicons name="folder-open-outline" size={18} color={c.brandNavy} />
              <Text style={styles.listHeaderText}>
                {t("gamePlans.totalPlans", {
                  defaultValue: "{{count}} game plans",
                  count: filteredPlans.length,
                })}
              </Text>
            </View>

            <View style={[styles.searchBar, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
              <Ionicons name="search-outline" size={18} color={c.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("gamePlans.searchPlaceholder", {
                  defaultValue: "Search by title…",
                })}
                placeholderTextColor={c.textMuted}
                style={[styles.searchInput, { color: c.text }]}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </View>

            {isTrainer && filterChips.length > 0 ? (
              <View style={styles.filterRow}>
                {filterChips.map((chip) => {
                  const active = planFilter === chip.id;
                  return (
                    <Pressable
                      key={chip.id}
                      onPress={() => setPlanFilter(chip.id)}
                      style={[
                        styles.filterChip,
                        {
                          borderColor: active ? c.brandNavy : c.border,
                          backgroundColor: active ? c.brandAccentSubtle : c.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: active ? c.brandNavy : c.textMuted },
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {filteredPlans.length === 0 ? (
              <Text style={styles.emptyFilter}>
                {t("gamePlans.noSearchResults", {
                  defaultValue: "No game plans match your search.",
                })}
              </Text>
            ) : (
              <View style={styles.planList}>
                {filteredPlans.map(({ item, sectionDate }, index) => {
                  const reportData = (item.reportData as { imageUrl?: string; title?: string }[] | undefined)?.[0];
                  const title = reportData?.title ?? String(item.title ?? t("gamePlans.planDefault", { defaultValue: "Game Plan" }));
                  const session = item.session as SessionPlanMeta | undefined;
                  const hasPdf = !!session?.report;
                  const pdfPending = session?.game_plan_pdf_status === "pending";
                  const isDraft = item.publish_status === "draft";
                  const lessonDate = formatLessonDate(session?.start_time ?? item.updatedAt);
                  const updatedLabel = formatRelativeUpdated(item.updatedAt);
                  const traineeLabel = String(
                    (item.trainee as { fullname?: string; fullName?: string })?.fullname ??
                      (item.trainee as { fullName?: string })?.fullName ?? ""
                  );
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
                  const canEdit = isTrainer && !!sessionId && !!trainerId && !!traineeId;
                  const showUpdated =
                    !isTrainer &&
                    !isDraft &&
                    !!updatedLabel &&
                    (updatedLabel.includes("just now") ||
                      updatedLabel.includes("m ago") ||
                      updatedLabel.includes("h ago"));

                  return (
                    <Pressable
                      key={`plan-${String(item._id ?? "row")}-${index}`}
                      style={({ pressed }) => [
                        styles.planCard,
                        { width: cardWidth },
                        pressed && { opacity: 0.94 },
                      ]}
                      onPress={() => openPlan(item)}
                      accessibilityRole="button"
                      accessibilityLabel={title}
                    >
                      <View style={styles.planHero}>
                        {uri ? (
                          <ImageWithSkeleton
                            uri={uri}
                            width={cardWidth}
                            height={PLAN_HERO_HEIGHT}
                            borderRadius={0}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.planHeroPlaceholder, { backgroundColor: km.bg }]}>
                            <Ionicons name={km.icon} size={44} color={km.color} />
                          </View>
                        )}
                        <View style={styles.heroBadgeRow}>
                          {isTrainer && isDraft ? (
                            <View style={styles.badgeDraft}>
                              <Text style={styles.badgeDraftText}>
                                {t("gamePlans.badgeDraft", { defaultValue: "Draft" })}
                              </Text>
                            </View>
                          ) : null}
                          {showUpdated ? (
                            <View style={styles.badgeUpdated}>
                              <Text style={styles.badgeUpdatedText}>
                                {t("gamePlans.badgeUpdated", { defaultValue: "Updated" })}
                              </Text>
                            </View>
                          ) : null}
                          {pdfPending ? (
                            <View style={styles.badgePending}>
                              <Text style={styles.badgePendingText}>
                                {t("gamePlans.badgeGenerating", { defaultValue: "Generating PDF…" })}
                              </Text>
                            </View>
                          ) : (
                            <View style={[styles.badgeKind, { backgroundColor: "rgba(255,255,255,0.92)" }]}>
                              <Ionicons name={km.icon} size={12} color={km.color} />
                              <Text style={[styles.badgeKindText, { color: km.color }]}>
                                {km.label}
                              </Text>
                            </View>
                          )}
                        </View>
                        {canEdit ? (
                          <Pressable
                            style={styles.editFab}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setEditPlan({
                                sessionId,
                                trainerId,
                                traineeId,
                                traineeName: traineeLabel || undefined,
                              });
                            }}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel={t("gamePlans.editPlan", { defaultValue: "Edit game plan" })}
                          >
                            <Ionicons name="create-outline" size={18} color={c.brandNavy} />
                          </Pressable>
                        ) : null}
                        <View style={styles.playOverlay} pointerEvents="none">
                          <View style={styles.playCircle}>
                            <Ionicons name="play" size={22} color="#fff" />
                          </View>
                        </View>
                      </View>
                      <View style={styles.planBody}>
                        <Text style={styles.planTitle} numberOfLines={2}>
                          {title}
                        </Text>
                        <Text style={styles.metaText} numberOfLines={1}>
                          {lessonDate ?? sectionDate}
                        </Text>
                        {isTrainer && traineeLabel ? (
                          <Text style={styles.metaText} numberOfLines={1}>
                            {t("gamePlans.withTrainee", {
                              defaultValue: "With {{name}}",
                              name: traineeLabel,
                            })}
                          </Text>
                        ) : null}
                        {!isTrainer && trainerLabel ? (
                          <Text style={styles.metaText} numberOfLines={1}>
                            {t("gamePlans.fromCoach", {
                              defaultValue: "Coach {{name}}",
                              name: trainerLabel,
                            })}
                          </Text>
                        ) : null}
                        {!isTrainer && updatedLabel ? (
                          <Text style={styles.updatedHint} numberOfLines={1}>
                            {updatedLabel}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
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
        ...typography.titleMd,
        color: palette.text,
        fontWeight: "700",
      },
      searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        borderWidth: 1,
        borderRadius: radii.md,
        paddingHorizontal: space.sm,
        paddingVertical: 8,
        marginBottom: space.sm,
      },
      searchInput: {
        flex: 1,
        ...typography.bodyMd,
        paddingVertical: 0,
      },
      filterRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.xs,
        marginBottom: space.sm,
      },
      filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        borderWidth: 1,
      },
      filterChipText: {
        ...typography.bodySm,
        fontWeight: "700",
      },
      emptyFilter: {
        ...typography.bodySm,
        color: palette.textMuted,
        textAlign: "center",
        paddingVertical: space.lg,
      },
      planList: {
        gap: space.md,
      },
      planCard: {
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        overflow: "hidden",
      },
      planHero: {
        height: PLAN_HERO_HEIGHT,
        width: "100%",
        position: "relative",
        backgroundColor: palette.surfaceMuted,
      },
      planHeroPlaceholder: {
        flex: 1,
        height: PLAN_HERO_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
      },
      heroBadgeRow: {
        position: "absolute",
        left: space.sm,
        bottom: space.sm,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        maxWidth: "70%",
      },
      playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
      },
      playCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: 3,
      },
      editFab: {
        position: "absolute",
        top: space.sm,
        right: space.sm,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.95)",
        borderWidth: 1,
        borderColor: palette.borderSubtle,
      },
      planBody: {
        padding: space.md,
        gap: 4,
      },
      badgeDraft: {
        backgroundColor: "#fff8e6",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
      },
      badgeDraftText: {
        ...typography.caption,
        fontWeight: "700",
        color: "#8a6d00",
      },
      badgeUpdated: {
        backgroundColor: palette.brandSubtle,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
      },
      badgeUpdatedText: {
        ...typography.caption,
        fontWeight: "700",
        color: palette.brandNavy,
      },
      badgePending: {
        backgroundColor: palette.surfaceMuted,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
      },
      badgePendingText: {
        ...typography.caption,
        fontWeight: "700",
        color: palette.brandNavy,
      },
      badgeKind: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
      },
      badgeKindText: {
        ...typography.caption,
        fontWeight: "700",
      },
      metaText: {
        ...typography.bodySm,
        color: palette.textMuted,
      },
      planTitle: {
        ...typography.titleSm,
        fontWeight: "700",
        color: palette.text,
        lineHeight: 22,
      },
      updatedHint: {
        ...typography.caption,
        color: palette.brandNavy,
        fontWeight: "600",
        marginTop: 4,
      },
    })
  );
}
