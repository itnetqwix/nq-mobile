import React from "react";
import { View } from "react-native";
import { Pill, Skeleton } from "../../../../components/ui";
import { radii, space } from "../../../../theme";
import { HomeSection } from "./HomeSection";
import { SeeAllButton } from "./SeeAllButton";
import { SessionPreviewRow } from "./SessionPreviewRow";

type Props = {
  title: string;
  subtitle?: string;
  sessions: Record<string, unknown>[];
  accountType: string | null;
  loading?: boolean;
  maxPreview?: number;
  seeAllLabel?: string;
  onSeeAll?: () => void;
  onSessionPress: (session: Record<string, unknown>) => void;
  testID?: string;
  /** Show count badge in header */
  count?: number;
};

export function SessionListSection({
  title,
  subtitle,
  sessions,
  accountType,
  loading,
  maxPreview = 3,
  seeAllLabel,
  onSeeAll,
  onSessionPress,
  testID,
  count,
}: Props) {
  const preview = sessions.slice(0, maxPreview);
  const showSeeAll = !!onSeeAll && sessions.length > maxPreview;

  const headerRight =
    count != null && count > 0 ? (
      <Pill label={String(count)} tone="warning" />
    ) : undefined;

  if (loading && sessions.length === 0) {
    return (
      <HomeSection title={title} subtitle={subtitle} testID={testID} headerRight={headerRight}>
        <View style={{ padding: space.md, gap: space.sm }}>
          <Skeleton width="100%" height={80} radius={radii.md} />
        </View>
      </HomeSection>
    );
  }

  if (!loading && sessions.length === 0) {
    return null;
  }

  return (
    <HomeSection
      title={title}
      subtitle={subtitle}
      testID={testID}
      headerRight={headerRight}
    >
      {preview.map((session, idx) => (
        <SessionPreviewRow
          key={`session-${String(session._id ?? idx)}-${idx}`}
          session={session}
          accountType={accountType}
          onPress={() => onSessionPress(session)}
          isLast={idx === preview.length - 1 && !showSeeAll}
        />
      ))}
      {showSeeAll && seeAllLabel && (
        <SeeAllButton label={seeAllLabel} onPress={onSeeAll} />
      )}
    </HomeSection>
  );
}
