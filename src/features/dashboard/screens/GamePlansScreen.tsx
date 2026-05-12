import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { isLikelyPdf } from "../../../lib/clipMediaUrl";
import { postReportsGetAll } from "../../home/api/homeApi";
import { LockerViewerModal, type LockerViewerMode } from "../components/locker/LockerViewerModal";

export function GamePlansScreen() {
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
    const img = item?.reportData?.[0]?.imageUrl;
    const title = item?.reportData?.[0]?.title ?? "Game plan";
    const pdfName = item?.session?.report;
    const fromImg = img ? getS3ImageUrl(img) : "";
    const fromPdf = pdfName ? getS3ImageUrl(pdfName) : "";
    const uri = fromImg || fromPdf;
    if (!uri) return;
    const mode: LockerViewerMode =
      isLikelyPdf(uri) || isLikelyPdf(pdfName) ? "pdf" : fromImg ? "image" : "pdf";
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandNavy} />
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
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={52} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No game plans yet</Text>
              <Text style={styles.emptyBody}>
                After sessions, reports you save on the web appear here grouped by date.
              </Text>
            </View>
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
                        <Image source={{ uri }} style={styles.planImg} resizeMode="cover" />
                      ) : (
                        <View style={[styles.planImg, styles.planPh]}>
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
  heroTitle: { fontSize: 22, fontWeight: "800", color: colors.brandNavy, letterSpacing: -0.3 },
  heroSub: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
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
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.brandNavy },
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
  planPh: { alignItems: "center", justifyContent: "center", backgroundColor: "#eef2ff" },
  planTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 8, lineHeight: 19 },
  planHint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: space.xl * 2, paddingHorizontal: space.lg, gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 21 },
});
