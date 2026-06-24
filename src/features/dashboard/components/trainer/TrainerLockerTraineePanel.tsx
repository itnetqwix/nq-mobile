import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchRecentTrainees, postTraineeClipsGrouped } from "../../../home/api/homeApi";
import { queryKeys } from "../../../../lib/queryKeys";
import {
  mergeRecentTraineeRows,
  parseTraineeClipGroups,
} from "../../../../lib/clips/traineeClipGroups";
import type { LockerClip } from "../../../clips/api/clipsApi";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { space, typography, useThemedStyles } from "../../../../theme";
import { TrainerRecentTraineesSection } from "./TrainerRecentTraineesSection";

type Props = {
  selectedTraineeId: string | null;
  onSelectTrainee: (trainee: Record<string, unknown> | null) => void;
  renderClipRow: (clip: LockerClip, key: string) => React.ReactNode;
};

export function TrainerLockerTraineePanel({
  selectedTraineeId,
  onSelectTrainee,
  renderClipRow,
}: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();

  const { data: recentTrainees = [], isLoading: loadingTrainees } = useQuery({
    queryKey: queryKeys.presence.recentTrainees,
    queryFn: fetchRecentTrainees,
    staleTime: 120_000,
  });

  const { data: traineeClipGroupsRaw } = useQuery({
    queryKey: queryKeys.trainerRole.recentTraineeClips,
    queryFn: postTraineeClipsGrouped,
    staleTime: 120_000,
  });

  const clipGroups = useMemo(
    () => parseTraineeClipGroups(traineeClipGroupsRaw),
    [traineeClipGroupsRaw]
  );

  const trainees = useMemo(
    () => mergeRecentTraineeRows(recentTrainees, clipGroups),
    [recentTrainees, clipGroups]
  );

  const selectedGroup = useMemo(
    () => clipGroups.find((group) => group.traineeId === selectedTraineeId) ?? null,
    [clipGroups, selectedTraineeId]
  );

  if (!loadingTrainees && trainees.length === 0) return null;

  return (
    <View>
      <TrainerRecentTraineesSection
        trainees={trainees}
        loading={loadingTrainees}
        selectedTraineeId={selectedTraineeId}
        onSelectTrainee={onSelectTrainee}
      />

      {selectedGroup ? (
        <View style={styles.clipsBlock}>
          <Text style={styles.sectionTitle}>
            {t("locker.traineeClipsSection", {
              name: selectedGroup.traineeName,
              defaultValue: "{{name}}'s clips",
            })}
          </Text>
          {selectedGroup.clips.map((clip, index) =>
            renderClipRow(clip, `trainee-clip-${selectedGroup.traineeId}-${String(clip._id ?? index)}`)
          )}
        </View>
      ) : selectedTraineeId ? (
        <Text style={styles.emptyHint}>
          {t("locker.noTraineeClips", {
            defaultValue: "No clips from this enthusiast yet.",
          })}
        </Text>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      clipsBlock: {
        marginTop: space.xs,
        marginBottom: space.sm,
      },
      sectionTitle: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "700",
        marginHorizontal: space.md,
        marginBottom: space.sm,
      },
      emptyHint: {
        ...typography.bodySm,
        color: palette.textMuted,
        marginHorizontal: space.md,
        marginBottom: space.md,
      },
    })
  );
}
