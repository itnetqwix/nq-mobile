import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Button, ImageWithSkeleton } from "../../../components/ui";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { fetchTrainersWithSlots } from "../../home/api/homeApi";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { type AppColors, radii, space, typography, useThemeColors } from "../../../theme";
import {
  extractTrainerReviews,
  getTrainerAvgRating,
  getTrainerBio,
  getTrainerCategories,
  getTrainerCertificates,
  getTrainerDegrees,
  getTrainerExtraSection,
  getTrainerHourlyRate,
  getTrainerWorkExperience,
  getTrainerId,
  getTrainerName,
} from "../lib/trainerUtils";
import { useAuth } from "../../auth/context/AuthContext";
import { useGuestMode } from "../../auth/hooks/useGuestMode";
import { resolveTraineeTimeZone } from "../../../lib/user/resolveTraineeTimeZone";
import {
  getTrainerNextSlots,
  getTrainerTodaySlotsCount,
} from "../lib/trainerUtils";
import { useRequireAuth } from "../../auth/hooks/useRequireAuth";
import { useFavoriteTrainers } from "../../dashboard/hooks/useFavoriteTrainers";
import { FavoriteHeartButton } from "../../dashboard/components/trainee/FavoriteHeartButton";
import { FriendSocialStrip } from "../../dashboard/components/trainee/FriendSocialStrip";
import { PublicSocialLinksRow } from "../../../components/social/PublicSocialLinksRow";
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
    <ImageWithSkeleton
      uri={url}
      width={72}
      height={72}
      borderRadius={36}
      style={styles.avatar}
      onLoadError={() => setFailed(true)}
    />
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
  const { user } = useAuth();
  const isGuest = useGuestMode();
  const { requireAuth } = useRequireAuth();
  const traineeTimeZone = resolveTraineeTimeZone(user ?? undefined);
  const { isFavorite, toggleFavorite } = useFavoriteTrainers(!isGuest);
  const trainerId = getTrainerId(trainer);

  const { data: enriched, isLoading } = useQuery({
    queryKey: ["trainerProfile", trainerId, traineeTimeZone],
    queryFn: async () => {
      if (!trainerId) return trainer;
      const rows = await fetchTrainersWithSlots({
        limit: 100,
        traineeTimeZone,
      });
      return rows.find((r) => String(r._id) === trainerId) ?? trainer;
    },
    enabled: visible && !!trainerId,
    staleTime: 60_000,
  });

  const [showAllReviews, setShowAllReviews] = useState(false);
  useEffect(() => {
    if (!visible) setShowAllReviews(false);
  }, [visible, trainerId]);

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
  const certificateRows = getTrainerCertificates(data);
  const workRows = getTrainerWorkExperience(data);
  const degreeRows = getTrainerDegrees(data);

  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 5);
  const hiddenReviewCount = Math.max(0, reviews.length - 5);
  const todaySlotsCount = getTrainerTodaySlotsCount(data);
  const todaySlotPreviews = getTrainerNextSlots(data, 4);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.header}>
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Ionicons name="chevron-down" size={28} color={themeColors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Coach profile</Text>
          {data ? (
            <FavoriteHeartButton
              active={isGuest ? false : isFavorite(data)}
              onPress={() => {
                if (isGuest) {
                  requireAuth(undefined, {
                    intent: "favorite",
                    messageKey: "guest.signInToContinue",
                    screen: "SignUp",
                  });
                  return;
                }
                toggleFavorite(data);
              }}
              accessibilityLabel={t("traineeDiscover.favoriteA11y", { name })}
              size={24}
            />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={themeColors.brandNavy} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 88 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <ProfileAvatar uri={data.profile_picture as string} name={name} styles={styles} />
              <View style={styles.heroBody}>
                <Text style={styles.name}>{name}</Text>
                <View style={styles.statsRow}>
                  {online && (
                    <View style={styles.onlinePill}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineText}>Online</Text>
                    </View>
                  )}
                  {avgRating != null && (
                    <View style={styles.statChip}>
                      <Ionicons name="star" size={14} color={themeColors.warning} />
                      <Text style={styles.statChipText}>{avgRating.toFixed(1)}</Text>
                      <Text style={styles.statChipMuted}>({reviews.length})</Text>
                    </View>
                  )}
                  {hourly != null && (
                    <View style={styles.statChip}>
                      <Text style={styles.statChipText}>${hourly.toFixed(0)}</Text>
                      <Text style={styles.statChipMuted}>/hr</Text>
                    </View>
                  )}
                </View>
                <PublicSocialLinksRow user={data} size="sm" />
                <FriendSocialStrip trainer={data} />
              </View>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Today&apos;s availability</Text>
              {todaySlotsCount != null && todaySlotsCount > 0 ? (
                <>
                  <Text style={styles.bodyText}>
                    {todaySlotsCount} bookable time{todaySlotsCount !== 1 ? "s" : ""} left today.
                  </Text>
                  <View style={styles.todaySlotsRow}>
                    {todaySlotPreviews.map((slot) => (
                      <Pressable
                        key={slot.iso ?? `${slot.time}`}
                        style={styles.todaySlotChip}
                        onPress={() => {
                          requireAuth(() => {
                            onSchedule(data);
                            onDismiss();
                          }, {
                            intent: "book",
                            messageKey: "guest.signInToBook",
                            trainer: data,
                            bookMode: "schedule",
                          });
                        }}
                      >
                        <Text style={styles.todaySlotTime}>{slot.time}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.availHint}>
                    Open Schedule for the full calendar and more dates.
                  </Text>
                </>
              ) : (
                <Text style={styles.bodyText}>
                  No times left today. Use Schedule to pick another day.
                </Text>
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

            {certificateRows.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>{t("trainerProfile.certificatesTitle")}</Text>
                {certificateRows.map((cert) => (
                  <View key={cert.id} style={styles.credentialCard}>
                    <Text style={styles.credentialTitle}>{cert.title}</Text>
                    <Text style={styles.bodyText}>{cert.issuer}</Text>
                    {cert.issued_at ? (
                      <Text style={styles.credentialMeta}>
                        {t("trainerProfile.issued")}: {cert.issued_at}
                        {cert.expires_at ? ` · ${t("trainerProfile.expires")}: ${cert.expires_at}` : ""}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {workRows.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>{t("trainerProfile.workTitle")}</Text>
                {workRows.map((job) => (
                  <View key={job.id} style={styles.credentialCard}>
                    <Text style={styles.credentialTitle}>{job.title}</Text>
                    {job.company ? <Text style={styles.bodyText}>{job.company}</Text> : null}
                    <Text style={styles.credentialMeta}>
                      {job.location} · {job.start_date}
                      {job.is_current
                        ? ` – ${t("trainerProfile.present")}`
                        : job.end_date
                          ? ` – ${job.end_date}`
                          : ""}
                    </Text>
                    {job.description ? <Text style={styles.bodyText}>{job.description}</Text> : null}
                  </View>
                ))}
              </View>
            )}

            {degreeRows.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>{t("trainerProfile.degreesTitle")}</Text>
                {degreeRows.map((deg) => (
                  <View key={deg.id} style={styles.credentialCard}>
                    <Text style={styles.credentialTitle}>{deg.degree}</Text>
                    <Text style={styles.bodyText}>{deg.institution}</Text>
                    {deg.field_of_study ? (
                      <Text style={styles.credentialMeta}>{deg.field_of_study}</Text>
                    ) : null}
                    {(deg.location || deg.graduation_year) && (
                      <Text style={styles.credentialMeta}>
                        {[deg.location, deg.graduation_year].filter(Boolean).join(" · ")}
                      </Text>
                    )}
                  </View>
                ))}
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
                <View style={styles.emptyReviewBox}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={themeColors.textMuted} />
                  <Text style={styles.emptyReviews}>No reviews yet - be the first to book a session.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.reviewMetaRow}>
                    <Text style={styles.reviewMetaText}>
                      Showing {Math.min(visibleReviews.length, reviews.length)} of {reviews.length} reviews
                    </Text>
                  </View>
                {visibleReviews.map((r) => (
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
                ))}
                  {hiddenReviewCount > 0 ? (
                    <Pressable style={styles.viewMoreBtn} onPress={() => setShowAllReviews(true)}>
                      <Text style={styles.viewMoreText}>View more reviews ({hiddenReviewCount})</Text>
                    </Pressable>
                  ) : reviews.length > 5 ? (
                    <Pressable style={styles.viewMoreBtn} onPress={() => setShowAllReviews(false)}>
                      <Text style={styles.viewMoreText}>Show less</Text>
                    </Pressable>
                  ) : null}
                </>
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
                  requireAuth(() => {
                    onInstant(data);
                    onDismiss();
                  }, {
                    intent: "book",
                    messageKey: "guest.signInToBook",
                    trainer: data,
                    bookMode: "instant",
                  });
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Schedule"
                variant="secondary"
                leftIcon="calendar-outline"
                onPress={() => {
                  requireAuth(() => {
                    onSchedule(data);
                    onDismiss();
                  }, {
                    intent: "book",
                    messageKey: "guest.signInToBook",
                    trainer: data,
                    bookMode: "schedule",
                  });
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
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { ...typography.titleSm, color: colors.text },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: space.md, paddingTop: space.sm },
    hero: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.md,
      paddingVertical: space.sm,
      marginBottom: space.sm,
    },
    heroBody: { flex: 1, minWidth: 0 },
    avatar: { width: 72, height: 72, borderRadius: 36 },
    avatarFallback: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.brandNavy,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: { color: colors.brandTextOn, fontSize: 28, fontWeight: "700" },
    name: { ...typography.titleSm, color: colors.text, fontWeight: "700" },
    statsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
    },
    onlinePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.pill,
      backgroundColor: `${colors.success}18`,
    },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
    onlineText: { ...typography.caption, color: colors.success, fontWeight: "700" },
    statChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statChipText: { ...typography.caption, color: colors.text, fontWeight: "800" },
    statChipMuted: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
    block: {
      marginBottom: space.sm,
      padding: space.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blockTitle: { ...typography.bodyMd, color: colors.text, marginBottom: 6, fontWeight: "700" },
    bodyText: { ...typography.bodyMd, color: colors.textSecondary, lineHeight: 22 },
    todaySlotsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: space.sm,
    },
    todaySlotChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.brandAccentSubtle,
      borderWidth: 1,
      borderColor: colors.brandAccent,
    },
    todaySlotTime: { fontSize: 13, fontWeight: "600", color: colors.brandNavy },
    availHint: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: space.sm,
    },
    catWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    catChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: `${colors.brandNavy}10`,
    },
    catChipText: { ...typography.caption, color: colors.brandNavy, fontWeight: "600" },
    emptyReviews: { ...typography.bodySm, color: colors.textMuted, fontStyle: "italic" },
    emptyReviewBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 4,
    },
    reviewMetaRow: {
      marginBottom: 8,
    },
    reviewMetaText: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: "600",
    },
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
    viewMoreBtn: {
      marginTop: space.sm,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    viewMoreText: {
      ...typography.bodySm,
      color: colors.brandNavy,
      fontWeight: "700",
    },
    credentialCard: {
      marginBottom: space.sm,
      paddingBottom: space.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    },
    credentialTitle: { ...typography.bodyMd, fontWeight: "700", color: colors.text },
    credentialMeta: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space.md,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    footerBtns: { flexDirection: "row", gap: 8 },
  });
}
