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
import { space, useThemeColors } from "../../../../theme";
import type { ClipRow } from "../../instantLessonClipsApi";
import { MAX_CLIPS } from "../constants";
import { useSharedStepStyles } from "../sharedStepStyles";
import { ClipPickerRow } from "../../components/ClipPickerRow";

type Props = {
  clipsQuery: UseQueryResult<ClipRow[], Error>;
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
  const c = useThemeColors();
  const sharedStepStyles = useSharedStepStyles();
  return (
    <View style={sharedStepStyles.card}>
      <Text style={sharedStepStyles.sectionTitle}>Videos (optional)</Text>
      <Text style={sharedStepStyles.muted}>
        Pick up to {MAX_CLIPS} clips from your locker — like the web locker step before the coach is notified.
      </Text>

      {clipsQuery.isLoading ? (
        <ActivityIndicator color={c.iconPrimary} style={{ marginVertical: space.lg }} />
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
              tintColor={c.iconPrimary}
            />
          }
        >
          {flatClips.map((clip, index) => (
            <ClipPickerRow
              key={`wizard-clip-${String(clip._id ?? "row")}-${index}`}
              clip={clip}
              selected={selectedClipIds.includes(clip._id)}
              onToggle={onToggleClip}
            />
          ))}
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
          <Ionicons name="arrow-forward" size={18} color={c.brandTextOn} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clipScroll: { maxHeight: 260, marginTop: space.sm },
});
