import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MorphRefreshHeader } from "../../components/ui";
import { useMorphRefreshBundle } from "../../lib/refresh/useMorphRefreshBundle";
import { colors, radii, space, typography } from "../../theme";
import type { RootStackParamList } from "../../navigation/types";
import { useInstantLesson } from "./InstantLessonContext";
import {
  addTraineeClipsToBookedSession,
  fetchMyClipsGrouped,
  flattenGroupedClips,
} from "./instantLessonClipsApi";
import { ClipPickerRow } from "./components/ClipPickerRow";
import { InstantLessonDeadlineChip } from "./components/InstantLessonDeadlineChip";
import {
  INSTANT_ACCEPT_WINDOW_MS,
  INSTANT_JOIN_AFTER_ACCEPT_MS,
} from "../../lib/sessions/instantLessonConstants";

const MAX_CLIPS = 2;

/**
 * Trainee instant-lesson flow aligned with web:
 * wait for coach → optionally pick clips while waiting → when coach accepts, app opens the live
 * meeting for both roles (same as web). "Upload or manage videos" opens the Clips shell.
 */
export function InstantLessonTraineeModal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const {
    traineeBooking,
    cancelBooking,
    clearTraineeBooking,
    minimizeBooking,
    joinAcceptedLesson,
  } = useInstantLesson();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /**
   * Modal is visible for every non-minimized booking step. We render a
   * dedicated success view for "accepted" (instead of hiding it like before)
   * so the trainee gets clear confirmation + a primary "Join now" CTA. The
   * `InstantLessonStatusBanner` still handles the minimized variants.
   */
  const visible = !!traineeBooking && !traineeBooking.minimized;
  const lessonId = traineeBooking?.lessonId ?? "";

  const openUploadsShell = () => {
    navigation.navigate(
      "Main",
      {
        screen: "Tabs",
        params: {
          screen: "Home",
          params: {
            screen: "ShellSurface",
            params: { surfaceId: "clips" },
          },
        },
      } as never
    );
  };

  const {
    data: clipGroups = [],
    isLoading: clipsLoading,
    isRefetching: clipsRefetching,
    refetch: refetchClips,
  } = useQuery({
    queryKey: queryKeys.instant.lessonClips(lessonId),
    queryFn: fetchMyClipsGrouped,
    enabled: visible && !!lessonId,
    staleTime: 30_000,
  });

  const flatClips = useMemo(() => flattenGroupedClips(clipGroups), [clipGroups]);
  const morphClips = useMorphRefreshBundle(() => void refetchClips(), clipsRefetching);

  React.useEffect(() => {
    if (!visible) setSelectedIds([]);
  }, [visible, lessonId]);

  const toggleClip = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_CLIPS) {
        Alert.alert("Limit reached", `You can attach at most ${MAX_CLIPS} clips for an instant lesson.`);
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const attachMutation = useMutation({
    mutationFn: async () => {
      if (!lessonId || selectedIds.length === 0) return;
      await addTraineeClipsToBookedSession(lessonId, selectedIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      Alert.alert("Clips attached", "Your clips are linked to this lesson.");
    },
    onError: (err: any) => {
      Alert.alert(
        "Could not attach clips",
        err?.response?.data?.message ?? err?.message ?? "Please try again."
      );
    },
  });

  const handleCancel = () => {
    Alert.alert("Cancel request", "Stop waiting and cancel this instant lesson?", [
      { text: "Keep waiting", style: "cancel" },
      { text: "Cancel lesson", style: "destructive", onPress: () => cancelBooking() },
    ]);
  };

  if (!traineeBooking || !visible) return null;

  const { step, trainerName } = traineeBooking;

  const clipPicker =
    step === "waiting" && (
      <View style={styles.clipSection}>
        <Text style={styles.clipSectionTitle}>Videos (optional)</Text>
        <Text style={styles.clipHint}>
          Select up to {MAX_CLIPS} clips from your locker. Attached clips will
          appear in the lesson when your coach joins. You can join without clips.
        </Text>
        <Pressable style={styles.uploadLink} onPress={openUploadsShell}>
          <Ionicons name="cloud-upload-outline" size={18} color={colors.sidebarActive} />
          <Text style={styles.uploadLinkText}>Upload or manage videos</Text>
        </Pressable>

        {clipsLoading ? (
          <ActivityIndicator color={colors.brandNavy} style={{ marginVertical: space.md }} />
        ) : flatClips.length === 0 ? (
          <Text style={styles.emptyClips}>No clips in your locker yet. Upload above, then pull to refresh.</Text>
        ) : (
          <>
          <MorphRefreshHeader {...morphClips.headerProps} />
          <ScrollView
            style={styles.clipList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            onScroll={morphClips.onMorphScroll}
            scrollEventThrottle={morphClips.scrollEventThrottle}
            refreshControl={
              <RefreshControl
                refreshing={morphClips.refreshing}
                onRefresh={morphClips.onRefreshControl}
                tintColor={colors.brandNavy}
              />
            }
          >
            {flatClips.map((clip, index) => (
              <ClipPickerRow
                key={`il-clip-${String(clip._id ?? "row")}-${index}`}
                clip={clip}
                selected={selectedIds.includes(clip._id)}
                onToggle={toggleClip}
              />
            ))}
          </ScrollView>
          </>
        )}

        <Text style={styles.selectedCount}>
          Selected: {selectedIds.length} / {MAX_CLIPS}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.attachBtn,
            (selectedIds.length === 0 || attachMutation.isPending) && styles.attachBtnDisabled,
            pressed && selectedIds.length > 0 && { opacity: 0.9 },
          ]}
          disabled={selectedIds.length === 0 || attachMutation.isPending}
          onPress={() => attachMutation.mutate()}
        >
          {attachMutation.isPending ? (
            <ActivityIndicator color={colors.brandTextOn} />
          ) : (
            <Text style={styles.attachBtnText}>Attach clips to this lesson</Text>
          )}
        </Pressable>
      </View>
    );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={minimizeBooking}>
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md },
        ]}
      >
        <View style={styles.card}>
          {step === "waiting" && (
            <>
              <Pressable style={styles.closeBtn} onPress={minimizeBooking} hitSlop={12}>
                <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
              </Pressable>
              <ActivityIndicator size="large" color={colors.brandNavy} />
              <Text style={styles.title}>Instant lesson</Text>
              <Text style={styles.sub}>
                Waiting for <Text style={{ fontWeight: "700" }}>{trainerName}</Text> to accept…
              </Text>
              <InstantLessonDeadlineChip
                deadlineMs={
                  traineeBooking.acceptDeadlineAt ??
                  Date.now() + INSTANT_ACCEPT_WINDOW_MS
                }
                label="Coach has"
              />
              <Text style={styles.hint}>
                Tap the down-arrow to keep browsing the app while you wait. You'll get a notification
                when the coach confirms.
              </Text>
              {clipPicker}
              <View style={styles.waitingActions}>
                <Pressable style={styles.minimizeBtn} onPress={minimizeBooking}>
                  <Ionicons name="contract-outline" size={16} color={colors.brandNavy} />
                  <Text style={styles.minimizeBtnText}>Wait in background</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={handleCancel}>
                  <Text style={styles.secondaryBtnText}>Cancel request</Text>
                </Pressable>
              </View>
            </>
          )}

          {step === "accepted" && (
            <>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
              </View>
              <Text style={styles.title}>Session confirmed!</Text>
              <Text style={styles.sub}>
                <Text style={{ fontWeight: "700" }}>{trainerName}</Text> is ready. Tap below to enter
                the live lesson now.
              </Text>
              <InstantLessonDeadlineChip
                deadlineMs={
                  traineeBooking.joinDeadlineAt ??
                  Date.now() + INSTANT_JOIN_AFTER_ACCEPT_MS
                }
                label="Join within"
                variant="urgent"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.joinNowBtn,
                  pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                ]}
                onPress={joinAcceptedLesson}
                accessibilityRole="button"
                accessibilityLabel="Join the lesson now"
              >
                <Ionicons name="videocam" size={18} color={colors.brandTextOn} />
                <Text style={styles.joinNowBtnText}>Join now</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={minimizeBooking}>
                <Text style={styles.secondaryBtnText}>Join later</Text>
              </Pressable>
            </>
          )}

          {(step === "declined" || step === "expired") && (
            <>
              <Ionicons name="close-circle" size={52} color={colors.danger} />
              <Text style={styles.title}>{step === "declined" ? "Request declined" : "Request expired"}</Text>
              <Text style={styles.sub}>
                {step === "declined"
                  ? "The trainer could not take this lesson right now. Try picking another coach."
                  : "No response in time. Try again later."}
              </Text>
              <Pressable style={styles.secondaryBtn} onPress={clearTraineeBooking}>
                <Text style={styles.secondaryBtnText}>OK</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: space.md,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    padding: space.lg,
    maxHeight: "88%",
    gap: space.sm,
  },
  title: { ...typography.titleMd, color: colors.text, textAlign: "center" },
  sub: { ...typography.bodyMd, color: colors.textMuted, textAlign: "center" },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  clipSection: {
    marginTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.md,
    gap: space.sm,
  },
  clipSectionTitle: { ...typography.subtitle, color: colors.brandNavy },
  clipHint: { ...typography.caption, color: colors.textMuted },
  uploadLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  uploadLinkText: { ...typography.bodyMd, fontWeight: "600", color: colors.sidebarActive },
  clipList: { maxHeight: 220 },
  emptyClips: { ...typography.bodySm, color: colors.textMuted, fontStyle: "italic" },
  selectedCount: { ...typography.caption, color: colors.textMuted },
  attachBtn: {
    backgroundColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  attachBtnDisabled: { backgroundColor: colors.borderStrong },
  attachBtnText: { ...typography.button, color: colors.brandTextOn },
  secondaryBtn: {
    marginTop: space.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { ...typography.button, color: colors.textSecondary },
  closeBtn: { position: "absolute", top: space.sm, right: space.sm, padding: 4, zIndex: 1 },
  waitingActions: { gap: space.xs },
  successBadge: {
    alignSelf: "center",
    paddingVertical: space.xs,
  },
  joinNowBtn: {
    marginTop: space.sm,
    backgroundColor: colors.success,
    borderRadius: radii.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  joinNowBtnText: { ...typography.button, color: colors.brandTextOn, fontSize: 16 },
  minimizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandSubtle,
    borderRadius: radii.md,
    paddingVertical: 12,
  },
  minimizeBtnText: { ...typography.bodyMd, fontWeight: "700", color: colors.brandNavy },
});
