import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { colors, radii, space } from "../../theme/tokens";
import type { RootStackParamList } from "../../navigation/types";
import { useInstantLesson } from "./InstantLessonContext";
import {
  addTraineeClipsToBookedSession,
  fetchMyClipsGrouped,
  flattenGroupedClips,
} from "./instantLessonClipsApi";
import { ClipPickerRow } from "./components/ClipPickerRow";

const MAX_CLIPS = 2;

/**
 * Trainee instant-lesson flow aligned with web:
 * wait for coach → optionally pick clips while waiting → when coach accepts, app opens the live
 * meeting for both roles (same as web). "Upload or manage videos" opens the Clips shell.
 */
export function InstantLessonTraineeModal() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const {
    traineeBooking,
    cancelBooking,
    clearTraineeBooking,
    minimizeBooking,
  } = useInstantLesson();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /**
   * Show the full-screen modal only when the trainee hasn't minimized it AND the step
   * isn't `accepted` (the accepted state is surfaced via a separate banner so it can
   * appear anywhere in the app).
   */
  const visible =
    !!traineeBooking &&
    !traineeBooking.minimized &&
    traineeBooking.step !== "accepted";
  const lessonId = traineeBooking?.lessonId ?? "";

  const openUploadsShell = () => {
    navigation.navigate(
      "Main",
      {
        screen: "Tabs",
        params: {
          screen: "Menu",
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
    queryKey: ["instantLessonClips", lessonId],
    queryFn: fetchMyClipsGrouped,
    enabled: visible && !!lessonId,
    staleTime: 30_000,
  });

  const flatClips = useMemo(() => flattenGroupedClips(clipGroups), [clipGroups]);

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
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
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
          Select up to {MAX_CLIPS} clips from your locker — same as the web instant-lesson picker. You
          can join without clips.
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
          <ScrollView
            style={styles.clipList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={clipsRefetching} onRefresh={() => refetchClips()} tintColor={colors.brandNavy} />
            }
          >
            {flatClips.map((clip) => (
              <ClipPickerRow
                key={clip._id}
                clip={clip}
                selected={selectedIds.includes(clip._id)}
                onToggle={toggleClip}
              />
            ))}
          </ScrollView>
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.attachBtnText}>Attach clips to this lesson</Text>
          )}
        </Pressable>
      </View>
    );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={minimizeBooking}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {step === "waiting" && (
            <>
              <Pressable style={styles.closeBtn} onPress={minimizeBooking} hitSlop={12}>
                <Ionicons name="chevron-down" size={22} color="#6b7280" />
              </Pressable>
              <ActivityIndicator size="large" color={colors.brandNavy} />
              <Text style={styles.title}>Instant lesson</Text>
              <Text style={styles.sub}>
                Waiting for <Text style={{ fontWeight: "700" }}>{trainerName}</Text> to accept…
              </Text>
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

          {(step === "declined" || step === "expired") && (
            <>
              <Ionicons name="close-circle" size={52} color="#dc2626" />
              <Text style={styles.title}>{step === "declined" ? "Request declined" : "Request expired"}</Text>
              <Text style={styles.sub}>
                {step === "declined"
                  ? "The trainer could not take this lesson right now."
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: space.md,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: space.lg,
    maxHeight: "88%",
    gap: space.sm,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center" },
  sub: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  hint: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  clipSection: {
    marginTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.md,
    gap: space.sm,
  },
  clipSectionTitle: { fontSize: 15, fontWeight: "700", color: colors.brandNavy },
  clipHint: { fontSize: 12, color: "#6b7280", lineHeight: 18 },
  uploadLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  uploadLinkText: { fontSize: 14, fontWeight: "600", color: colors.sidebarActive },
  clipList: { maxHeight: 220 },
  emptyClips: { fontSize: 13, color: "#9ca3af", fontStyle: "italic" },
  selectedCount: { fontSize: 12, color: "#6b7280" },
  attachBtn: {
    backgroundColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  attachBtnDisabled: { backgroundColor: "#9ca3af" },
  attachBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    marginTop: space.xs,
    backgroundColor: "#f3f4f6",
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
  closeBtn: { position: "absolute", top: space.sm, right: space.sm, padding: 4, zIndex: 1 },
  waitingActions: { gap: space.xs },
  minimizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f0f4ff",
    borderRadius: radii.md,
    paddingVertical: 12,
  },
  minimizeBtnText: { fontSize: 14, fontWeight: "700", color: colors.brandNavy },
});
