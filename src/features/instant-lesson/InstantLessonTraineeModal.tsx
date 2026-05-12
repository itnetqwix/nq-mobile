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
  type ClipRow,
} from "./instantLessonClipsApi";

const MAX_CLIPS = 2;

/**
 * Trainee instant-lesson flow aligned with web `InstantLessonTraineeModal`:
 * wait for coach → optionally pick up to 2 existing clips → attach to booking → join when accepted.
 * "New upload" deep-links to the same Uploads shell as the web locker file panel.
 */
export function InstantLessonTraineeModal() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { traineeBooking, cancelBooking, clearTraineeBooking } = useInstantLesson();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const visible = !!traineeBooking;
  const lessonId = traineeBooking?.lessonId ?? "";

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

  const openUploadsShell = () => {
    navigation.navigate(
      "Main",
      {
        screen: "Tabs",
        params: {
          screen: "Menu",
          params: {
            screen: "ShellSurface",
            params: { surfaceId: "uploads" },
          },
        },
      } as never
    );
  };

  const handleJoinLesson = () => {
    if (!traineeBooking?.lessonId) return;
    const id = traineeBooking.lessonId;
    clearTraineeBooking();
    navigation.navigate("Meeting", { lessonId: id });
  };

  const handleCancel = () => {
    Alert.alert("Cancel request", "Stop waiting and cancel this instant lesson?", [
      { text: "Keep waiting", style: "cancel" },
      { text: "Cancel lesson", style: "destructive", onPress: () => cancelBooking() },
    ]);
  };

  if (!traineeBooking) return null;

  const { step, trainerName } = traineeBooking;

  const clipPicker =
    (step === "waiting" || step === "accepted") && (
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
            {flatClips.map((clip: ClipRow) => {
              const on = selectedIds.includes(clip._id);
              const label = clip.title || clip.name || "Untitled clip";
              return (
                <Pressable
                  key={clip._id}
                  style={[styles.clipRow, on && styles.clipRowOn]}
                  onPress={() => toggleClip(clip._id)}
                >
                  <Ionicons
                    name={on ? "checkbox" : "square-outline"}
                    size={22}
                    color={on ? colors.brandNavy : "#9ca3af"}
                  />
                  <Text style={styles.clipLabel} numberOfLines={2}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
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
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {step === "waiting" && (
            <>
              <ActivityIndicator size="large" color={colors.brandNavy} />
              <Text style={styles.title}>Instant lesson</Text>
              <Text style={styles.sub}>
                Waiting for <Text style={{ fontWeight: "700" }}>{trainerName}</Text> to accept…
              </Text>
              <Text style={styles.hint}>The trainer has about two minutes to respond. You can add clips while you wait (optional).</Text>
              {clipPicker}
              <Pressable style={styles.secondaryBtn} onPress={handleCancel}>
                <Text style={styles.secondaryBtnText}>Cancel request</Text>
              </Pressable>
            </>
          )}

          {step === "accepted" && (
            <>
              <Ionicons name="checkmark-circle" size={52} color="#16a34a" />
              <Text style={styles.title}>Coach accepted</Text>
              <Text style={styles.sub}>{trainerName} is ready. Add clips if you want, then join.</Text>
              {clipPicker}
              <Pressable style={styles.primaryBtn} onPress={handleJoinLesson}>
                <Ionicons name="videocam" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Join lesson</Text>
              </Pressable>
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
  clipList: { maxHeight: 160 },
  clipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  clipRowOn: { borderColor: colors.brandNavy, backgroundColor: "#f0f4ff" },
  clipLabel: { flex: 1, fontSize: 14, color: "#111827" },
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
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16a34a",
    borderRadius: radii.md,
    paddingVertical: 14,
    marginTop: space.sm,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    marginTop: space.xs,
    backgroundColor: "#f3f4f6",
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },
});
