import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, Skeleton } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { getClipPlaybackUrl, isLikelyPdf } from "../../../lib/clipMediaUrl";
import { postGetAllSavedSessions } from "../../home/api/homeApi";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";

export function SavedLessonsScreen() {
  const savedQ = useQuery({
    queryKey: ["locker", "savedSessions"],
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

  const openSaved = (row: any) => {
    const uri = getClipPlaybackUrl(row);
    if (!uri) return;
    const nameHint = row?.file_name ?? row?.title ?? "";
    const mode: LockerViewerMode = isLikelyPdf(nameHint) || isLikelyPdf(uri) ? "pdf" : "video";
    setViewer({
      uri,
      title: row?.title ?? row?.file_name ?? "Saved lesson",
      mode,
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Saved lessons</Text>
        <Text style={styles.heroSub}>
          Recordings stored in your locker from the web. Tap to watch or open PDFs in the app.
        </Text>
      </View>

      {savedQ.isLoading ? (
        <View style={styles.scroll}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <Skeleton width="100%" height={92} radius={radii.md} />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={savedQ.isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.brandNavy}
            />
          }
        >
          {(savedQ.data ?? []).length === 0 ? (
            <EmptyState
              icon="bookmark-outline"
              title="No saved lessons"
              description="When you save a session recording on the website, it will show up here."
            />
          ) : (
            (savedQ.data ?? []).map((s: any) => {
              const playable = !!getClipPlaybackUrl(s);
              return (
                <Pressable
                  key={String(s._id)}
                  style={[styles.card, !playable && styles.cardDisabled]}
                  onPress={() => playable && openSaved(s)}
                  disabled={!playable}
                >
                  <View style={styles.cardIcon}>
                    <Ionicons name="play-circle-outline" size={28} color={colors.brandNavy} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{s.title ?? s.file_name ?? "Saved session"}</Text>
                    {!!s.description && (
                      <Text style={styles.cardDesc} numberOfLines={3}>
                        {s.description}
                      </Text>
                    )}
                    <Text style={styles.cardMeta}>
                      {s.trainee_name || s.trainer_name
                        ? `${s.trainee_name ?? ""} ${s.trainer_name ?? ""}`.trim()
                        : ""}
                      {s.createdAt ? ` · ${new Date(s.createdAt).toLocaleDateString()}` : ""}
                    </Text>
                    {!playable && (
                      <Text style={styles.unavailable}>Preview not available for this file.</Text>
                    )}
                  </View>
                  {playable && <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      <LockerViewerModal
        visible={!!viewer}
        onClose={() => setViewer(null)}
        uri={viewer?.uri ?? ""}
        title={viewer?.title}
        mode={viewer?.mode ?? "video"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  heroTitle: { ...typography.titleLg, color: colors.brandNavy },
  heroSub: { ...typography.bodySm, color: colors.textMuted, marginTop: 6 },
  scroll: { padding: space.md, paddingBottom: space.xl * 2, gap: space.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  cardDisabled: { opacity: 0.65 },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.sidebarActiveBg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1 },
  cardTitle: { ...typography.titleSm, color: colors.text },
  cardDesc: { ...typography.bodySm, color: colors.textMuted, marginTop: 6 },
  cardMeta: { ...typography.caption, color: colors.textMuted, marginTop: 8 },
  unavailable: { ...typography.caption, color: colors.warning, marginTop: 6, fontWeight: "600" },
});
