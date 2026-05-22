import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { getClipPlaybackUrl, isLikelyPdf } from "../../../lib/clipMediaUrl";
import { postGetAllSavedSessions } from "../../home/api/homeApi";
import { LockerListShell } from "../components/locker/LockerListShell";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";

export function SavedLessonsScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      card: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
      },
      cardDisabled: { opacity: 0.65 },
      cardIcon: {
        width: 48,
        height: 48,
        borderRadius: radii.sm,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      cardBody: { flex: 1, minWidth: 0 },
      cardTitle: { ...typography.titleSm, color: palette.text },
      cardDesc: { ...typography.bodySm, color: palette.textMuted, marginTop: 4 },
      cardMeta: { ...typography.caption, color: palette.textMuted, marginTop: 6 },
      unavailable: { ...typography.caption, color: palette.warning, marginTop: 4, fontWeight: "600" },
    })
  );

  const savedQ = useQuery({
    queryKey: queryKeys.locker.savedSessions,
    queryFn: postGetAllSavedSessions,
    staleTime: 30_000,
  });

  const [viewer, setViewer] = useState<{
    uri: string;
    title: string;
    mode: LockerViewerMode;
  } | null>(null);

  const onRefresh = useCallback(() => {
    void savedQ.refetch();
  }, [savedQ]);

  const openSaved = (row: Record<string, unknown>) => {
    const uri = getClipPlaybackUrl(row);
    if (!uri) return;
    const nameHint = String(row?.file_name ?? row?.title ?? "");
    const mode: LockerViewerMode = isLikelyPdf(nameHint) || isLikelyPdf(uri) ? "pdf" : "video";
    setViewer({
      uri,
      title: String(row?.title ?? row?.file_name ?? t("savedLessons.lessonDefault")),
      mode,
    });
  };

  return (
    <>
      <LockerListShell
        loading={savedQ.isLoading}
        isError={savedQ.isError}
        error={savedQ.error}
        onRetry={() => void savedQ.refetch()}
        refreshing={savedQ.isRefetching}
        onRefresh={onRefresh}
      >
        {(savedQ.data ?? []).length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title={t("savedLessons.emptyTitle")}
            description={t("savedLessons.emptyDescription")}
          />
        ) : (
          (savedQ.data ?? []).map((s: Record<string, unknown>) => {
            const playable = !!getClipPlaybackUrl(s);
            return (
              <Pressable
                key={String(s._id)}
                style={[styles.card, !playable && styles.cardDisabled]}
                onPress={() => playable && openSaved(s)}
                disabled={!playable}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="play-circle-outline" size={28} color={c.iconPrimary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>
                    {String(s.title ?? s.file_name ?? t("savedLessons.sessionDefault"))}
                  </Text>
                  {!!s.description && (
                    <Text style={styles.cardDesc} numberOfLines={3}>
                      {String(s.description)}
                    </Text>
                  )}
                  <Text style={styles.cardMeta}>
                    {[s.trainee_name, s.trainer_name].filter(Boolean).join(" ")}
                    {s.createdAt ? ` · ${new Date(String(s.createdAt)).toLocaleDateString()}` : ""}
                  </Text>
                  {!playable ? (
                    <Text style={styles.unavailable}>{t("savedLessons.previewUnavailable")}</Text>
                  ) : null}
                </View>
                {playable ? (
                  <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
                ) : null}
              </Pressable>
            );
          })
        )}
      </LockerListShell>

      <LockerViewerModal
        visible={!!viewer}
        onClose={() => setViewer(null)}
        uri={viewer?.uri ?? ""}
        title={viewer?.title}
        mode={viewer?.mode ?? "video"}
      />
    </>
  );
}
