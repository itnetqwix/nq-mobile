/**
 * Content-shape skeletons — pre-composed `Skeleton` arrangements that
 * mirror the final layout of common screens. Using these instead of a
 * generic gray rectangle keeps the perceived load time low because the
 * eye lands on the same hot-spots before the data arrives.
 *
 * Each shape is intentionally small (4–8 sub-shapes) and theme-aware:
 * tinted backgrounds come from `useThemeColors()` so the placeholder
 * blends with light + dark surfaces alike.
 *
 *   <SessionRowSkeleton />     - matches `SessionCard`
 *   <ChatRowSkeleton />        - matches the chats list row
 *   <ClipCardSkeleton />       - matches the locker clip thumbnail card
 *   <ProfileHeaderSkeleton />  - matches the trainer profile hero
 *   <TransactionRowSkeleton /> - matches the wallet row
 *   <TrainerBrowseCardSkeleton /> - matches `TrainerBrowseCard`
 *   <CoachBoxSkeleton />         - horizontal coach tiles on home
 *   <CoachCarouselSkeleton />    - horizontal strip with optional header
 *   <ClipTileSkeleton />         - locker / recent-clips thumbnail
 *
 * Wrap your screen's loading branch with `SkeletonGroup` so multiple
 * skeletons inherit the same pulse cadence (avoids "Christmas tree"
 * effect from independent timers).
 */

import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { radii, space, useThemeColors } from "../../theme";
import { Skeleton } from "./Skeleton";

export type SkeletonGroupProps = {
  count?: number;
  /** Vertical gap between repeats (default `space.sm`). */
  gap?: number;
  /** Renderer for a single row — defaults to `<SessionRowSkeleton />`. */
  renderRow?: (index: number) => React.ReactNode;
  style?: ViewStyle;
};

export function SkeletonGroup({
  count = 3,
  gap = space.sm,
  renderRow,
  style,
}: SkeletonGroupProps) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i}>{renderRow ? renderRow(i) : <SessionRowSkeleton />}</View>
      ))}
    </View>
  );
}

export function SessionRowSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <Skeleton width={48} height={48} radius={24} />
      <View style={styles.flex1Stack}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="45%" height={11} />
        <Skeleton width="30%" height={11} />
      </View>
      <Skeleton width={72} height={28} radius={radii.pill} />
    </View>
  );
}

export function ChatRowSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: c.surface, borderBottomColor: c.borderSubtle },
      ]}
    >
      <Skeleton width={56} height={56} radius={28} />
      <View style={[styles.flex1Stack, { gap: 6 }]}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="80%" height={11} />
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Skeleton width={36} height={10} />
        <Skeleton width={22} height={20} radius={11} />
      </View>
    </View>
  );
}

export function ClipCardSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.clipCard,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <Skeleton width="100%" height={140} radius={radii.md} />
      <View style={{ padding: space.sm, gap: 6 }}>
        <Skeleton width="80%" height={13} />
        <Skeleton width="45%" height={11} />
      </View>
    </View>
  );
}

export function ProfileHeaderSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.profile,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <Skeleton width={88} height={88} radius={44} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" height={12} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Skeleton width={64} height={26} radius={radii.pill} />
          <Skeleton width={64} height={26} radius={radii.pill} />
        </View>
      </View>
    </View>
  );
}

export function TransactionRowSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.txRow,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <Skeleton width={40} height={40} radius={20} />
      <View style={[styles.flex1Stack, { gap: 6 }]}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="35%" height={11} />
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Skeleton width={56} height={13} />
        <Skeleton width={44} height={20} radius={radii.pill} />
      </View>
    </View>
  );
}

export type CoachBoxSkeletonVariant =
  | "forYou"
  | "pastBooked"
  | "favorite"
  | "guestSeeded"
  | "recentlyViewed";

const COACH_BOX_WIDTH: Record<CoachBoxSkeletonVariant, number> = {
  forYou: 148,
  pastBooked: 108,
  favorite: 96,
  guestSeeded: 108,
  recentlyViewed: 116,
};

export function CoachBoxSkeleton({
  variant = "pastBooked",
}: {
  variant?: CoachBoxSkeletonVariant;
}) {
  const c = useThemeColors();
  const width = COACH_BOX_WIDTH[variant];
  const tall = variant === "forYou";

  return (
    <View
      style={[
        styles.coachBox,
        {
          width,
          minHeight: tall ? 188 : 120,
          backgroundColor: c.surfaceElevated,
          borderColor: c.border,
        },
      ]}
    >
      <Skeleton
        width={variant === "favorite" ? 52 : 56}
        height={variant === "favorite" ? 52 : 56}
        radius={variant === "favorite" ? 26 : 28}
        style={{ alignSelf: "center" }}
      />
      <Skeleton width="85%" height={12} style={{ alignSelf: "center", marginTop: 6 }} />
      {tall ? (
        <>
          <Skeleton width="70%" height={10} style={{ alignSelf: "center" }} />
          <Skeleton
            width="92%"
            height={28}
            radius={radii.pill}
            style={{ alignSelf: "center", marginTop: 8 }}
          />
        </>
      ) : (
        <Skeleton width="72%" height={10} radius={radii.pill} style={{ alignSelf: "center", marginTop: 8 }} />
      )}
    </View>
  );
}

export type CoachCarouselSkeletonProps = {
  count?: number;
  variant?: CoachBoxSkeletonVariant;
  showHeader?: boolean;
  style?: ViewStyle;
};

export function CoachCarouselSkeleton({
  count = 3,
  variant = "pastBooked",
  showHeader = true,
  style,
}: CoachCarouselSkeletonProps) {
  const c = useThemeColors();
  return (
    <View style={[{ marginBottom: space.sm }, style]}>
      {showHeader ? (
        <View style={styles.carouselHeader}>
          <Skeleton width={18} height={18} radius={9} />
          <Skeleton width={140} height={16} />
          <Skeleton width="38%" height={11} style={{ flex: 1, marginLeft: 4 }} />
        </View>
      ) : null}
      <View style={[styles.carouselStrip, { borderColor: c.border }]}>
        {Array.from({ length: count }, (_, i) => (
          <CoachBoxSkeleton key={i} variant={variant} />
        ))}
      </View>
    </View>
  );
}

/** Full coach browse card — avatar, meta, slot chips, action row. */
export function TrainerBrowseCardSkeleton({ compact }: { compact?: boolean }) {
  const c = useThemeColors();
  const avatar = compact ? 52 : 64;

  return (
    <View
      style={[
        styles.trainerCard,
        compact && styles.trainerCardCompact,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <View style={styles.trainerCardRow}>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Skeleton width={avatar} height={avatar} radius={avatar / 2} />
          <Skeleton width={52} height={18} radius={radii.pill} />
        </View>
        <View style={[styles.flex1Stack, { gap: 5 }]}>
          <Skeleton width="72%" height={16} />
          <Skeleton width="55%" height={11} />
          <Skeleton width="40%" height={11} />
          <Skeleton width="48%" height={11} />
          {!compact ? <Skeleton width="62%" height={11} /> : null}
        </View>
      </View>
      {!compact ? (
        <View style={styles.slotsStripSkeleton}>
          <Skeleton width={13} height={13} radius={4} />
          <Skeleton width={72} height={11} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={64} height={28} radius={radii.pill} />
          ))}
        </View>
      ) : null}
      <View style={styles.trainerFooter}>
        <Skeleton width={36} height={36} radius={18} />
        <Skeleton width="38%" height={36} radius={radii.md} style={{ flex: 1 }} />
        <Skeleton width="38%" height={36} radius={radii.md} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function ClipTileSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.clipTile,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <Skeleton width={120} height={80} radius={radii.md} />
      <Skeleton width={88} height={10} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex1Stack: { flex: 1, gap: 6 },
  clipCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  coachBox: {
    padding: space.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 4,
  },
  carouselHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  carouselStrip: {
    flexDirection: "row",
    gap: space.sm,
    paddingVertical: 4,
  },
  trainerCard: {
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: space.sm,
  },
  trainerCardCompact: { padding: space.sm },
  trainerCardRow: {
    flexDirection: "row",
    gap: space.md,
    alignItems: "flex-start",
  },
  slotsStripSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  trainerFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: 2,
  },
  clipTile: {
    width: 120,
    padding: space.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
  },
});
