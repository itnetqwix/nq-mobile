import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../components/ui";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchTrainersWithSlots } from "../../home/api/homeApi";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { type AppColors, radii, space, typography, useThemeColors } from "../../../theme";
import {
  extractTrainerReviews,
  getTrainerAvgRating,
  getTrainerBio,
  getTrainerCategories,
  getTrainerExtraSection,
  getTrainerHourlyRate,
  getTrainerId,
  getTrainerName,
} from "../lib/trainerUtils";
import { useFavoriteTrainers } from "../../dashboard/hooks/useFavoriteTrainers";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

type Props = {
  visible: boolean;
  trainer: Record<string, unknown> | null;
  onDismiss: () => void;
  onInstant: (trainer: Record<string, unknown>) => void;
  onSchedule: (trainer: Record<string, unknown>) => void;
};

function ProfileAvatar({
  uri,
  name,
  styles,
}: {
  uri?: string;
  name: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarInitial}>{name[0]?.toUpperCase() ?? "?"}</Text>
      </View>
    );
  }
  return (
    <Image source={{ uri: url }} style={styles.avatar} onError={() => setFailed(true)} />
  );
}

export function TrainerProfileModal({
  visible,
  trainer,
  onDismiss,
  onInstant,
  onSchedule,
}: Props) {
  const { t } = useAppTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => makeStyles(themeColors), [themeColors]);
  const insets = useSafeAreaInsets();
  const { isOnline } = useOnlinePresence();
  const { isFavorite, toggleFavorite } = useFavoriteTrainers();
  const trainerId = getTrainerId(trainer);

  const { data: enriched, isLoading } = useQuery({
    queryKey: ["trainerProfile", trainerId],
    queryFn: async () => {
      if (!trainerId) return trainer;
      const rows = await fetchTrainersWithSlots({ limit: 100 });
      return rows.find((r) => String(r._id) === trainerId) ?? trainer;
    },
    enabled: visible && !!trainerId,
    staleTime: 60_000,
  });

  const data = (enriched ?? trainer) as Record<string, unknown> | null;
  if (!data) return null;

  const name = getTrainerName(data);
  const categories = getTrainerCategories(data);
  const hourly = getTrainerHourlyRate(data);
  const avgRating = getTrainerAvgRating(data);
  const bio = getTrainerBio(data);
  const reviews = extractTrainerReviews(data);
  const online = isOnline(trainerId) || !!(data as any)?.is_online;
  const teachingStyle = getTrainerExtraSection(data, "teaching_style");
  const credentials = getTrainerExtraSection(data, "credentials_and_affiliations");
  const curriculum = getTrainerExtraSection(data, "curriculum");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Ionicons name="close" size={26} color={themeColors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Coach profile</Text>
          {data ? (
            <Pressable
              onPress={() => toggleFavorite(data)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t("traineeDiscover.favoriteA11y", { name })}
            >
              <Ionicons
                name={isFavorite(data) ? "star" : "star-outline"}
                size={26}
                color={isFavorite(data) ? themeColors.warning : themeColors.textMuted}
              />
            </Pressable>
          ) : (
            <View style={{ width: 26 }} />
          )}
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={themeColors.brandNavy} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <ProfileAvatar uri={data.profile_picture as string} name={name} styles={styles} />
              <Text style={styles.name}>{name}</Text>
              {online && (
                <View style={styles.onlineRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Online now</Text>
                </View>
              )}
              {avgRating != null && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={18} color={themeColors.warning} />
                  <Text style={styles.ratingValue}>{avgRating.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>
                    ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
                  </Text>
                </View>
              )}
              {hourly != null && (
                <Text style={styles.rate}>${hourly.toFixed(0)} <Text style={styles.rateUnit}>/ hour</Text></Text>
              )}
            </View>

            {categories.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Specialties</Text>
                <View style={styles.catWrap}>
                  {categories.map((cat) => (
                    <View key={cat} style={styles.catChip}>
                      <Text style={styles.catChipText}>{cat}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!!bio && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>About</Text>
                <Text style={styles.bodyText}>{bio}</Text>
              </View>
            )}

            {!!teachingStyle && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Teaching style</Text>
                <Text style={styles.bodyText}>{teachingStyle}</Text>
              </View>
            )}

            {!!credentials && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Credentials & affiliations</Text>
                <Text style={styles.bodyText}>{credentials}</Text>
              </View>
            )}

            {!!curriculum && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Curriculum</Text>
                <Text style={styles.bodyText}>{curriculum}</Text>
              </View>
            )}

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Reviews</Text>
              {reviews.length === 0 ? (
                <Text style={styles.emptyReviews}>No reviews yet — be the first to book a session.</Text>
              ) : (
                reviews.slice(0, 12).map((r) => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewTop}>
                      <Text style={styles.reviewName}>{r.traineeName}</Text>
                      <View style={styles.reviewStars}>
                        <Ionicons name="star" size={14} color={themeColors.warning} />
                        <Text style={styles.reviewScore}>{r.sessionRating.toFixed(1)}</Text>
                      </View>
                    </View>
                    {!!r.title && <Text style={styles.reviewTitle}>{r.title}</Text>}
                    {!!r.remarks && <Text style={styles.reviewBody}>{r.remarks}</Text>}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.footerBtns}>
            <View style={{ flex: 1 }}>
              <Button
                label="Instant lesson"
                leftIcon="flash"
                onPress={() => {
                  onInstant(data);
                  onDismiss();
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Schedule"
                variant="secondary"
                leftIcon="calendar-outline"
                onPress={() => {
                  onSchedule(data);
                  onDismiss();
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: space.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { ...typography.titleSm, color: colors.text },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: space.md },
    hero: { alignItems: "center", paddingVertical: space.lg },
    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarFallback: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.brandNavy,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: { color: colors.brandTextOn, fontSize: 36, fontWeight: "700" },
    name: { ...typography.titleMd, color: colors.text, marginTop: space.md, textAlign: "center" },
    onlineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    onlineText: { ...typography.bodySm, color: colors.success, fontWeight: "600" },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
    ratingValue: { ...typography.titleSm, color: colors.text, fontWeight: "700" },
    ratingCount: { ...typography.bodySm, color: colors.textMuted },
    rate: { ...typography.titleMd, color: colors.brandNavy, marginTop: 8, fontWeight: "700" },
    rateUnit: { ...typography.bodyMd, color: colors.textMuted, fontWeight: "500" },
    block: {
      marginBottom: space.md,
      padding: space.md,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blockTitle: { ...typography.subtitle, color: colors.text, marginBottom: space.sm, fontWeight: "700" },
    bodyText: { ...typography.bodyMd, color: colors.textSecondary, lineHeight: 22 },
    catWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    catChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: `${colors.brandNavy}10`,
    },
    catChipText: { ...typography.caption, color: colors.brandNavy, fontWeight: "600" },
    emptyReviews: { ...typography.bodySm, color: colors.textMuted, fontStyle: "italic" },
    reviewCard: {
      paddingVertical: space.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    },
    reviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    reviewName: { ...typography.bodySm, fontWeight: "600", color: colors.text },
    reviewStars: { flexDirection: "row", alignItems: "center", gap: 4 },
    reviewScore: { ...typography.caption, fontWeight: "700", color: colors.text },
    reviewTitle: { ...typography.bodySm, fontWeight: "600", color: colors.text, marginTop: 4 },
    reviewBody: { ...typography.bodySm, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space.md,
      paddingTop: space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    footerBtns: { flexDirection: "row", gap: 10 },
  });
}
