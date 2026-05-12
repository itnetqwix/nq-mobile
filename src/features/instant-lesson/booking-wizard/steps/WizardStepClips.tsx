import { Ionicons } from "@expo/vector-icons";
import type { UseQueryResult } from "@tanstack/react-query";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radii, space } from "../../../../theme/tokens";
import type { ClipGroup, ClipRow } from "../../instantLessonClipsApi";
import { MAX_CLIPS } from "../constants";
import { sharedStepStyles } from "../sharedStepStyles";

type Props = {
  clipsQuery: UseQueryResult<ClipGroup[], Error>;
  flatClips: ClipRow[];
  selectedClipIds: string[];
  onToggleClip: (id: string) => void;
  onSkip: () => void;
  onNext: () => void;
};

export function WizardStepClips({
  clipsQuery,
  flatClips,
  selectedClipIds,
  onToggleClip,
  onSkip,
  onNext,
}: Props) {
  return (
    <View style={sharedStepStyles.card}>
      <Text style={sharedStepStyles.sectionTitle}>Videos (optional)</Text>
      <Text style={sharedStepStyles.muted}>
        Pick up to {MAX_CLIPS} clips from your locker — like the web locker step before the coach is notified.
      </Text>

      {clipsQuery.isLoading ? (
        <ActivityIndicator color={colors.brandNavy} style={{ marginVertical: space.lg }} />
      ) : flatClips.length === 0 ? (
        <Text style={sharedStepStyles.muted}>No clips yet. You can skip and add them later.</Text>
      ) : (
        <ScrollView
          nestedScrollEnabled
          style={styles.clipScroll}
          refreshControl={
            <RefreshControl
              refreshing={clipsQuery.isRefetching}
              onRefresh={() => clipsQuery.refetch()}
              tintColor={colors.brandNavy}
            />
          }
        >
          {flatClips.map((clip) => {
            const on = selectedClipIds.includes(clip._id);
            const label = clip.title || clip.name || "Untitled clip";
            return (
              <Pressable
                key={clip._id}
                style={[styles.clipRow, on && styles.clipRowOn]}
                onPress={() => onToggleClip(clip._id)}
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
      <Text style={sharedStepStyles.mutedSmall}>
        Selected: {selectedClipIds.length} / {MAX_CLIPS}
      </Text>

      <View style={sharedStepStyles.rowGap}>
        <Pressable style={sharedStepStyles.secondaryBtn} onPress={onSkip}>
          <Text style={sharedStepStyles.secondaryBtnText}>Skip clips</Text>
        </Pressable>
        <Pressable style={sharedStepStyles.primaryBtn} onPress={onNext}>
          <Text style={sharedStepStyles.primaryBtnText}>Next: review</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clipScroll: { maxHeight: 220, marginTop: space.sm },
  clipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  clipRowOn: { borderColor: colors.brandNavy, backgroundColor: colors.sidebarActiveBg },
  clipLabel: { flex: 1, fontSize: 14, color: colors.text },
});
