import React, { useCallback, useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { queryKeys } from "../../../lib/queryKeys";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ImageWithSkeleton, MorphRefreshScrollSurface, Skeleton } from "../../../components/ui";
import {
  FLASHLIST_PERF_DEFAULTS,
} from "../../../lib/lists/flatListPerf";
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
import { fetchRecentTrainees } from "../../home/api/homeApi";
import { useOnlinePresence } from "../../socket/useOnlinePresence";
import { useAuth } from "../../auth/context/AuthContext";
import { AccountType } from "../../../constants/accountType";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { openChatWithUser } from "../../chats/lib/openChatWithUser";
import { sendTraineeNudge } from "../../dashboard/api/trainerNotesApi";
import { StudentNoteSheet } from "../components/StudentNoteSheet";
import { TraineeProfileModal } from "../components/TraineeProfileModal";

function Avatar({
  uri,
  name,
  size = 52,
  photoLabel,
  profilePhotoLabel,
}: {
  uri?: string;
  name?: string;
  size?: number;
  photoLabel: string;
  profilePhotoLabel: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);

  React.useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!url || failed) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>
          {(name ?? "?")[0]?.toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <ImageWithSkeleton
      uri={url}
      width={size}
      height={size}
      borderRadius={size / 2}
      resizeMode="cover"
      onLoadError={() => setFailed(true)}
      accessibilityLabel={name ? photoLabel : profilePhotoLabel}
    />
  );
}

function StudentCard({
  student,
  onPressProfile,
  onMessage,
  onNudge,
  onNote,
  messageBusy,
  nudgeBusy,
}: {
  student: Record<string, unknown>;
  onPressProfile: () => void;
  onMessage: () => void;
  onNudge: () => void;
  onNote: () => void;
  messageBusy: boolean;
  nudgeBusy: boolean;
}) {
  const { t } = useAppTranslation();
  const { isOnline } = useOnlinePresence();
  const name = String(student?.fullname ?? student?.fullName ?? t("trainees.studentDefault"));
  const userId = String(student?._id ?? "");
  const email = String(student?.email ?? "");
  const joined = student?.createdAt
    ? new Date(String(student.createdAt)).toLocaleDateString()
    : "";

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPressProfile}
        accessibilityRole="button"
        accessibilityLabel={t("trainees.viewProfileA11y", {
          name,
          defaultValue: "View {{name}} profile",
        })}
      >
        <Avatar
          uri={student?.profile_picture as string | undefined}
          name={name}
          size={52}
          photoLabel={t("trainees.photoOf", { name })}
          profilePhotoLabel={t("trainees.profilePhoto")}
        />
      </Pressable>
      <View style={styles.cardInfo}>
        <Pressable onPress={onPressProfile} accessibilityRole="button">
          <Text style={styles.studentName}>{name}</Text>
        </Pressable>
        {!!email && <Text style={styles.studentEmail}>{email}</Text>}
        {!!joined && (
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText}>{t("trainees.joined", { date: joined })}</Text>
          </View>
        )}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
            onPress={onMessage}
            disabled={messageBusy}
            accessibilityRole="button"
            accessibilityLabel={t("trainees.messageA11y", { name, defaultValue: "Message {{name}}" })}
          >
            {messageBusy ? (
              <ActivityIndicator size="small" color={colors.brandNavy} />
            ) : (
              <>
                <Ionicons name="chatbubble-outline" size={14} color={colors.brandNavy} />
                <Text style={styles.actionText}>{t("trainees.message", { defaultValue: "Message" })}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
            onPress={onNudge}
            disabled={nudgeBusy}
            accessibilityRole="button"
            accessibilityLabel={t("trainees.nudgeA11y", { name, defaultValue: "Nudge {{name}} to book" })}
          >
            {nudgeBusy ? (
              <ActivityIndicator size="small" color={colors.brandNavy} />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={14} color={colors.brandNavy} />
                <Text style={styles.actionText}>{t("trainees.nudgeBook", { defaultValue: "Nudge" })}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtnIcon, pressed && styles.actionPressed]}
            onPress={onNote}
            accessibilityRole="button"
            accessibilityLabel={t("trainees.noteA11y", { name, defaultValue: "Private note for {{name}}" })}
          >
            <Ionicons name="bookmark-outline" size={16} color={colors.brandNavy} />
          </Pressable>
        </View>
      </View>
      {(isOnline(userId) || !!student?.is_online) && (
        <View style={styles.onlineDot} />
      )}
    </View>
  );
}

export function StudentsScreen() {
  const { t } = useAppTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const gutter = useHorizontalGutter("md");
  const { accountType } = useAuth();
  const isTrainer = accountType === AccountType.TRAINER;
  const [messageBusyId, setMessageBusyId] = useState<string | null>(null);
  const [nudgeBusyId, setNudgeBusyId] = useState<string | null>(null);
  const [noteTarget, setNoteTarget] = useState<{ id: string; name: string } | null>(null);
  const [profileTarget, setProfileTarget] = useState<Record<string, unknown> | null>(null);

  const listPad = useMemo(
    () => ({
      ...gutter,
      paddingTop: space.md,
      paddingBottom: space.xl + insets.bottom,
      gap: space.sm,
    }),
    [gutter, insets.bottom]
  );

  const { data: students = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.presence.recentTrainees,
    queryFn: fetchRecentTrainees,
    enabled: isTrainer,
    staleTime: 120_000,
  });

  const handleMessage = useCallback(
    async (student: Record<string, unknown>) => {
      const id = String(student._id ?? "");
      if (!id) return;
      setMessageBusyId(id);
      try {
        await openChatWithUser(
          navigation,
          {
            _id: id,
            fullname: String(student.fullname ?? student.fullName ?? t("trainees.studentDefault")),
            profile_picture: student.profile_picture as string | undefined,
          },
          t
        );
      } finally {
        setMessageBusyId(null);
      }
    },
    [navigation, t]
  );

  const handleNudge = useCallback(
    async (student: Record<string, unknown>) => {
      const id = String(student._id ?? "");
      const name = String(student.fullname ?? student.fullName ?? t("trainees.studentDefault"));
      if (!id) return;
      setNudgeBusyId(id);
      try {
        const { sent, message } = await sendTraineeNudge({ traineeId: id, template: "comeback" });
        if (sent) {
          Alert.alert(
            t("trainees.nudgeSentTitle", { defaultValue: "Nudge sent" }),
            message || t("trainees.nudgeSentBody", { name, defaultValue: "{{name}} received a booking reminder." })
          );
        } else {
          Alert.alert(t("common.error"), message || t("trainees.nudgeFailed", { defaultValue: "Could not send nudge." }));
        }
      } catch {
        Alert.alert(t("common.error"), t("trainees.nudgeFailed", { defaultValue: "Could not send nudge." }));
      } finally {
        setNudgeBusyId(null);
      }
    },
    [t]
  );

  if (!isTrainer) {
    return (
      <View style={listPad}>
        <EmptyState
          icon="lock-closed-outline"
          title={t("trainees.notAvailableTitle")}
          description={t("trainees.notAvailableDescription")}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={listPad}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{ marginBottom: space.sm, flexDirection: "row", gap: space.sm, alignItems: "center" }}
          >
            <Skeleton width={44} height={44} radius={22} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={12} />
              <Skeleton width="80%" height={10} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <>
      <MorphRefreshScrollSurface onRefresh={refetch} externalRefreshing={isRefetching} tintColor={colors.brandNavy}>
        {({ refreshControl, onScroll, scrollEventThrottle }) => (
      <FlashList
        data={students}
        keyExtractor={flatListKeyExtractor}
        renderItem={({ item }) => {
          const id = String((item as Record<string, unknown>)._id ?? "");
          const name = String(
            (item as Record<string, unknown>).fullname ??
              (item as Record<string, unknown>).fullName ??
              t("trainees.studentDefault")
          );
          return (
            <StudentCard
              student={item as Record<string, unknown>}
              onPressProfile={() => setProfileTarget(item as Record<string, unknown>)}
              onMessage={() => void handleMessage(item as Record<string, unknown>)}
              onNudge={() => void handleNudge(item as Record<string, unknown>)}
              onNote={() => setNoteTarget({ id, name })}
              messageBusy={messageBusyId === id}
              nudgeBusy={nudgeBusyId === id}
            />
          );
        }}
        contentContainerStyle={listPad}
        refreshControl={refreshControl}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        {...FLASHLIST_PERF_DEFAULTS}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={t("trainees.emptyTitle")}
            description={t("trainees.emptyDescription")}
          />
        }
      />
        )}
      </MorphRefreshScrollSurface>
      {noteTarget ? (
        <StudentNoteSheet
          visible
          traineeId={noteTarget.id}
          traineeName={noteTarget.name}
          onClose={() => setNoteTarget(null)}
        />
      ) : null}
      {profileTarget ? (
        <TraineeProfileModal
          visible
          trainee={profileTarget}
          onDismiss={() => setProfileTarget(null)}
          onMessage={() => {
            void handleMessage(profileTarget);
          }}
          onNudge={() => {
            void handleNudge(profileTarget);
          }}
          messageBusy={messageBusyId === String(profileTarget._id ?? "")}
          nudgeBusy={nudgeBusyId === String(profileTarget._id ?? "")}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardInfo: { flex: 1 },
  studentName: { ...typography.subtitle, color: colors.text },
  studentEmail: { ...typography.bodySm, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  metaText: { ...typography.caption, color: colors.textMuted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 88,
    justifyContent: "center",
  },
  actionBtnIcon: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  actionPressed: { opacity: 0.88 },
  actionText: { ...typography.caption, color: colors.brandNavy, fontWeight: "700" },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success, marginTop: 4 },

  avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },
});
