import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState, ImageWithSkeleton, Skeleton } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { isLikelyPdf } from "../../../lib/clipMediaUrl";
import { postReportsGetAll } from "../../home/api/homeApi";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";

export function GamePlansScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const planThumbWidth = Math.max(
    160,
    windowWidth - space.md * 4 - space.sm * 2
  );

  const reportsQ = useQuery({
    queryKey: ["locker", "reports"],
    queryFn: () => postReportsGetAll({}),
    staleTime: 30_000,
  });

  const [viewer, setViewer] = useState<{
    uri: string;
    title: string;
    mode: LockerViewerMode;
  } | null>(null);

  const reportSections = useMemo(() => {
    const rows = reportsQ.data ?? [];
    return rows.map((grp: any) => ({
      title: grp?._id
        ? `${grp._id.month}/${grp._id.day}/${grp._id.year}`
        : "Reports",
      data: grp?.report ?? [],
    }));
  }, [reportsQ.data]);

  const openPlan = (item: any) => {
    /**
     * Game plans can come back in two shapes from `POST /report/get-all`:
     *   • `reportData[0].imageUrl`  — image-based plans authored on web.
     *   • `session.report`          — PDF file key stored on `booked_sessions.report`.
     * The session can also carry a `sessionRecordingUrl` (video) when the trainer
     * recorded the lesson. Surface the best available artifact in that order.
     */
    const img = item?.reportData?.[0]?.imageUrl;
    const title = item?.reportData?.[0]?.title ?? "Game plan";
    const pdfName = item?.session?.report;
    const recording = item?.session?.sessionRecordingUrl ?? item?.sessionRecordingUrl;

    const fromImg = img ? getS3ImageUrl(img) : "";
    const fromPdf = pdfName ? getS3ImageUrl(pdfName) : "";
    const fromRec =
      typeof recording === "string" && recording.length > 0
        ? getS3ImageUrl(recording)
        : "";

    const uri = fromImg || fromPdf || fromRec;
    if (!uri) {
      Alert.alert(
        "Nothing to preview",
        "This game plan doesn't have an attached image, PDF, or recording yet."
      );
      return;
    }

    let mode: LockerViewerMode;
    if (fromImg && !isLikelyPdf(fromImg)) {
      mode = "image";
    } else if (fromPdf || isLikelyPdf(uri)) {
      mode = "pdf";
    } else {
      mode = "video";
    }
    setViewer({ uri, title, mode });
  };

  const onRefresh = useCallback(() => {
    void reportsQ.refetch();
  }, [reportsQ]);

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Game plans</Text>
        <Text style={styles.heroSub}>
          Session reports and PDFs from your locker. Tap a card to preview inside the app.
        </Text>
      </View>

      {reportsQ.isLoading ? (
        <View style={styles.scroll}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <Skeleton width="100%" height={80} radius={radii.md} />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={reportsQ.isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.brandNavy}
            />
          }
        >
          {reportSections.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="No game plans yet"
              description="After sessions, reports you save on the web appear here grouped by date."
            />
          ) : (
            reportSections.map((section, si) => (
              <View key={`${section.title}-${si}`} style={styles.section}>
                <View style={styles.sectionHead}>
                  <Ionicons name="calendar-outline" size={18} color={colors.brandNavy} />
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                {section.data.map((item: any, index: number) => {
                  const img = item?.reportData?.[0]?.imageUrl;
                  const title = item?.reportData?.[0]?.title ?? "Game plan";
                  const uri = img ? getS3ImageUrl(img) : "";
                  return (
                    <Pressable
                      key={String(item?._id ?? index)}
                      style={styles.planCard}
                      onPress={() => openPlan(item)}
                    >
                      {uri ? (
                        <ImageWithSkeleton
                          uri={uri}
                          width={planThumbWidth}
                          height={140}
                          borderRadius={radii.sm}
                          resizeMode="cover"
                          accessibilityLabel={title}
                        />
                      ) : (
                        <View style={[styles.planImg, styles.planPh, { width: planThumbWidth }]}>
                          <Ionicons name="document-outline" size={36} color={colors.sidebarActive} />
                        </View>
                      )}
                      <Text style={styles.planTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <Text style={styles.planHint}>Tap to preview</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <LockerViewerModal
        visible={!!viewer}
        onClose={() => setViewer(null)}
        uri={viewer?.uri ?? ""}
        title={viewer?.title}
        mode={viewer?.mode ?? "pdf"}
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
  scroll: { padding: space.md, paddingBottom: space.xl * 2, gap: space.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  sectionTitle: { ...typography.subtitle, color: colors.brandNavy },
  planCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.sm,
    backgroundColor: colors.surface,
  },
  planImg: {
    width: "100%",
    height: 140,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  planPh: { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSubtle },
  planTitle: { ...typography.bodyMd, fontWeight: "600", color: colors.text, marginTop: 8 },
  planHint: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
});
