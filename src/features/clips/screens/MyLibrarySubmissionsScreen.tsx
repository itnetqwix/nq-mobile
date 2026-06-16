import React, { useCallback, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState, ImageWithSkeleton } from "../../../components/ui";
import { AccountType } from "../../../constants/accountType";
import {
  radii,
  space,
  typography,
  useThemeColors,
  useThemedStyles,
} from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { LockerListShell } from "../../dashboard/components/locker/LockerListShell";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchMyLibrarySubmissions,
  type LibrarySubmissionRow,
  type LibrarySubmissionStatus,
} from "../api/clipsApi";
import { getClipThumbnailUrl } from "../../../lib/clipMediaUrl";

type FilterKey = "all" | "open" | "accepted" | "rejected";

/**
 * Personal "submission queue" screen for the NetQwix master library. Hits
 * `GET /clips/library-submissions/mine` (already populated with the source
 * clip) and renders a per-row status pill so trainers/trainees can track
 * where each clip stands without re-opening the locker.
 */
export function MyLibrarySubmissionsScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const [filter, setFilter] = useState<FilterKey>("all");
  const styles = useStyles();

  if (!isTrainer) {
    return (
      <EmptyState
        icon="library-outline"
        title={t("librarySubmissions.trainerOnlyTitle", { defaultValue: "Trainers only" })}
        description={t("librarySubmissions.trainerOnlyBody", { defaultValue: "Only trainers can submit clips to the NetQwix Library." })}
      />
    );
  }

  const q = useQuery({
    queryKey: queryKeys.clips.mySubmissions,
    queryFn: fetchMyLibrarySubmissions,
    staleTime: 30_000,
  });

  const rows = useMemo<LibrarySubmissionRow[]>(() => q.data ?? [], [q.data]);
  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "open") {
      return rows.filter(
        (r) => r.status === "submitted" || r.status === "under_review"
      );
    }
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const map: Record<LibrarySubmissionStatus, number> = {
      submitted: 0,
      under_review: 0,
      accepted: 0,
      rejected: 0,
    };
    for (const r of rows) {
      const s = r.status as LibrarySubmissionStatus;
      if (map[s] != null) map[s] += 1;
    }
    return map;
  }, [rows]);

  const onRefresh = useCallback(() => {
    void q.refetch();
  }, [q]);

  const toolbar = (
    <View style={styles.toolbar}>
      <Text style={styles.headline}>
        {t("librarySubmissions.title", { defaultValue: "My library submissions" })}
      </Text>
      <Text style={styles.subline}>
        {t("librarySubmissions.subtitle", {
          defaultValue:
            "Track every clip you've submitted to the NetQwix master library.",
        })}
      </Text>
      <View style={styles.filterRow}>
        {([
          ["all", t("librarySubmissions.filterAll", { defaultValue: "All" }), rows.length] as const,
          [
            "open",
            t("librarySubmissions.filterOpen", { defaultValue: "In review" }),
            counts.submitted + counts.under_review,
          ] as const,
          [
            "accepted",
            t("librarySubmissions.filterAccepted", { defaultValue: "Published" }),
            counts.accepted,
          ] as const,
          [
            "rejected",
            t("librarySubmissions.filterRejected", { defaultValue: "Rejected" }),
            counts.rejected,
          ] as const,
        ]).map(([key, label, count]) => {
          const active = filter === key;
          return (
            <Pressable
              key={`filter-${key}`}
              style={[styles.filterChip, active && styles.filterChipOn]}
              onPress={() => setFilter(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.filterLabel, active && styles.filterLabelOn]}
              >
                {label}
              </Text>
              <View style={[styles.countDot, active && styles.countDotOn]}>
                <Text
                  style={[styles.countDotText, active && styles.countDotTextOn]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <LockerListShell
      loading={q.isLoading}
      isError={q.isError}
      error={q.error}
      onRetry={() => void q.refetch()}
      refreshing={q.isRefetching}
      onRefresh={onRefresh}
      toolbar={toolbar}
    >
      {filtered.length === 0 ? (
        <EmptyState
          icon="library-outline"
          title={
            rows.length === 0
              ? t("librarySubmissions.emptyTitle", {
                  defaultValue: "No submissions yet",
                })
              : t("librarySubmissions.emptyFilteredTitle", {
                  defaultValue: "Nothing in this view",
                })
          }
          description={
            rows.length === 0
              ? t("librarySubmissions.emptyDescription", {
                  defaultValue:
                    "Tap the library icon on any of your clips to submit it to the NetQwix master library. You'll see its status here.",
                })
              : t("librarySubmissions.emptyFilteredDescription", {
                  defaultValue: "Try a different filter.",
                })
          }
        />
      ) : (
        filtered.map((row, idx) => (
          <SubmissionRow
            key={`sub-${row?._id ?? "row"}-${idx}`}
            row={row}
            c={c}
            styles={styles}
            t={t}
          />
        ))
      )}
    </LockerListShell>
  );
}

function SubmissionRow({
  row,
  c,
  styles,
  t,
}: {
  row: LibrarySubmissionRow;
  c: ReturnType<typeof useThemeColors>;
  styles: ReturnType<typeof useStyles>;
  t: ReturnType<typeof useAppTranslation>["t"];
}) {
  const clip =
    typeof row.source_clip_id === "object" && row.source_clip_id !== null
      ? row.source_clip_id
      : null;
  const title =
    clip?.title ||
    clip?.file_name ||
    t("locker.clipDefault", { defaultValue: "Clip" });
  const thumb = getClipThumbnailUrl(clip as Record<string, unknown> | null);
  const meta = statusMeta(row.status, c);
  const submittedAt = row.createdAt ? new Date(row.createdAt) : null;
  const reviewedAt = row.reviewed_at ? new Date(row.reviewed_at) : null;

  return (
    <View style={styles.card}>
      <View style={styles.thumbWrap}>
        {thumb ? (
          <ImageWithSkeleton
            uri={thumb}
            width={64}
            height={64}
            borderRadius={radii.sm}
            resizeMode="cover"
            accessibilityLabel={String(title)}
          />
        ) : (
          <View style={styles.thumbPh}>
            <Ionicons name="film-outline" size={26} color={c.brandAccent} />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {String(title)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={12} color={meta.fg} />
          <Text style={[styles.statusPillText, { color: meta.fg }]}>
            {meta.label(t)}
          </Text>
        </View>
        {submittedAt ? (
          <Text style={styles.metaLine}>
            {t("librarySubmissions.submittedAt", {
              defaultValue: "Submitted {{date}}",
              date: submittedAt.toLocaleDateString(),
            })}
          </Text>
        ) : null}
        {reviewedAt ? (
          <Text style={styles.metaLine}>
            {t("librarySubmissions.reviewedAt", {
              defaultValue: "Reviewed {{date}}",
              date: reviewedAt.toLocaleDateString(),
            })}
          </Text>
        ) : null}
        {row.status === "rejected" && row.rejection_reason ? (
          <View style={styles.reasonBox}>
            <Ionicons name="alert-circle-outline" size={14} color={c.danger} />
            <Text style={[styles.reasonText, { color: c.danger }]}>
              {row.rejection_reason}
            </Text>
          </View>
        ) : null}
        {row.status === "accepted" && row.published_library_clip_id ? (
          <Pressable
            style={styles.inlineLinkRow}
            onPress={() =>
              void Linking.openURL(
                `https://netqwix.com/library/${row.published_library_clip_id}`
              ).catch(() => {
                /* best-effort deep link */
              })
            }
          >
            <Ionicons name="open-outline" size={14} color={c.brandAccent} />
            <Text style={[styles.inlineLinkText, { color: c.brandAccent }]}>
              {t("librarySubmissions.openPublished", {
                defaultValue: "Open published clip",
              })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function statusMeta(
  status: LibrarySubmissionStatus,
  c: ReturnType<typeof useThemeColors>
): {
  bg: string;
  fg: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: (
    t: ReturnType<typeof useAppTranslation>["t"]
  ) => string;
} {
  switch (status) {
    case "accepted":
      return {
        bg: c.successSubtle,
        fg: c.success,
        icon: "checkmark-circle-outline",
        label: (t) =>
          t("locker.libraryStatusAccepted", { defaultValue: "Published" }),
      };
    case "rejected":
      return {
        bg: c.dangerSubtle,
        fg: c.danger,
        icon: "close-circle-outline",
        label: (t) =>
          t("locker.libraryStatusRejected", { defaultValue: "Rejected" }),
      };
    case "under_review":
      return {
        bg: c.warningSubtle,
        fg: c.warning,
        icon: "eye-outline",
        label: (t) =>
          t("locker.libraryStatusUnderReview", {
            defaultValue: "Under review",
          }),
      };
    case "submitted":
    default:
      return {
        bg: c.brandSubtle,
        fg: c.brandNavy,
        icon: "time-outline",
        label: (t) =>
          t("locker.libraryStatusSubmitted", { defaultValue: "Submitted" }),
      };
  }
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      toolbar: { gap: space.xs, paddingTop: space.xs },
      headline: { ...typography.titleMd, color: palette.text },
      subline: { ...typography.caption, color: palette.textMuted },
      filterRow: {
        flexDirection: "row",
        gap: 6,
        flexWrap: "wrap",
        marginTop: 6,
      },
      filterChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
      },
      filterChipOn: {
        backgroundColor: palette.brandNavy,
        borderColor: palette.brandNavy,
      },
      filterLabel: {
        ...typography.label,
        fontSize: 12,
        color: palette.textMuted,
      },
      filterLabelOn: { color: palette.brandTextOn, fontWeight: "700" },
      countDot: {
        minWidth: 18,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: radii.pill,
        backgroundColor: palette.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
      },
      countDotOn: { backgroundColor: palette.surfaceElevated },
      countDotText: { fontSize: 10, fontWeight: "700", color: palette.text },
      countDotTextOn: { color: palette.brandNavy },
      card: {
        flexDirection: "row",
        gap: space.md,
        padding: space.sm,
        marginBottom: space.sm,
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      thumbWrap: {
        width: 64,
        height: 64,
        borderRadius: radii.sm,
        overflow: "hidden",
        backgroundColor: palette.surfaceMuted,
      },
      thumbPh: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.brandSubtle,
      },
      body: { flex: 1, gap: 4, minWidth: 0 },
      title: { ...typography.bodyMd, fontWeight: "700", color: palette.text },
      statusPill: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
      },
      statusPillText: { fontSize: 11, fontWeight: "800" },
      metaLine: { ...typography.caption, color: palette.textMuted },
      reasonBox: {
        flexDirection: "row",
        gap: 6,
        alignItems: "flex-start",
        marginTop: 4,
      },
      reasonText: {
        ...typography.caption,
        flex: 1,
      },
      inlineLinkRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
      },
      inlineLinkText: { fontSize: 12, fontWeight: "700" },
    })
  );
}
