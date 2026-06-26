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

import React, { useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { useContentWidth, useContentWidthFraction } from "../../lib/layout";
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
  forYou: 136,
  pastBooked: 136,
  favorite: 136,
  guestSeeded: 136,
  recentlyViewed: 136,
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
        width={58}
        height={58}
        radius={29}
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

/** Blinkit-style hero carousel placeholder on home. */
export function HeroCarouselSkeleton({ cardHeight = 168 }: { cardHeight?: number }) {
  const c = useThemeColors();
  return (
    <View style={{ marginBottom: space.sm, paddingHorizontal: space.md }}>
      <View style={styles.carouselHeader}>
        <Skeleton width={100} height={16} />
        <Skeleton width={32} height={12} />
      </View>
      <Skeleton
        width="100%"
        height={cardHeight}
        radius={radii.lg}
        style={{ backgroundColor: c.surfaceMuted }}
      />
      <View style={[styles.dotsRow, { marginTop: space.sm }]}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={i === 0 ? 16 : 6} height={6} radius={3} />
        ))}
      </View>
    </View>
  );
}

/** “Offers for you” horizontal strip placeholder. */
export function OffersCarouselSkeleton() {
  const c = useThemeColors();
  const offerWidth = useContentWidthFraction(0.72);
  return (
    <View
      style={{
        marginHorizontal: -space.md,
        paddingVertical: space.md,
        marginBottom: space.sm,
        backgroundColor: c.surfaceMuted,
      }}
    >
      <Skeleton width={180} height={14} style={{ alignSelf: "center", marginBottom: space.sm }} />
      <View style={[styles.carouselStrip, { borderColor: "transparent", paddingHorizontal: space.md }]}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              styles.offerCard,
              {
                width: offerWidth,
                backgroundColor: c.surfaceElevated,
                borderColor: c.border,
              },
            ]}
          >
            <Skeleton width={48} height={48} radius={radii.md} />
            <View style={[styles.flex1Stack, { gap: 6 }]}>
              <Skeleton width="85%" height={14} />
              <Skeleton width="70%" height={11} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Trainer/trainee home — unified gate while `GET /cms/home` is in flight. */
export function TrainerHomeSkeleton() {
  const contentWidth = useContentWidth();
  const heroHeight = useMemo(() => Math.round(contentWidth * 0.45), [contentWidth]);
  return (
    <View style={{ gap: space.sm }}>
      <HeroCarouselSkeleton cardHeight={heroHeight} />
      <OffersCarouselSkeleton />
    </View>
  );
}

/** Wallet tab — balance card + ledger block. */
export function WalletBalanceSkeleton() {
  const c = useThemeColors();
  return (
    <View style={{ padding: space.lg, gap: space.md }}>
      <View
        style={[
          styles.walletCard,
          { backgroundColor: c.surfaceElevated, borderColor: c.border },
        ]}
      >
        <Skeleton width={120} height={12} />
        <Skeleton width={180} height={32} style={{ marginTop: space.sm }} />
        <Skeleton width="60%" height={11} style={{ marginTop: space.sm }} />
      </View>
      <Skeleton width="100%" height={120} radius={radii.lg} />
      <Skeleton width={100} height={16} style={{ marginTop: space.sm }} />
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={styles.walletLedgerRow}>
          <Skeleton width="55%" height={12} />
          <Skeleton width={72} height={12} />
        </View>
      ))}
    </View>
  );
}

/** Trainer promo code card — matches `PromoCard` in TrainerPromoCodesScreen. */
export function PromoRowSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.promoSkeletonCard,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <View style={styles.promoSkeletonTop}>
        <View style={styles.flex1Stack}>
          <Skeleton width="45%" height={18} />
          <Skeleton width="70%" height={12} />
        </View>
        <Skeleton width={64} height={24} radius={radii.pill} />
      </View>
      <Skeleton width="50%" height={11} style={{ marginTop: space.sm }} />
      <View style={[styles.promoSkeletonActions, { marginTop: space.md }]}>
        <Skeleton width={72} height={14} />
        <Skeleton width={56} height={14} />
        <Skeleton width={64} height={14} />
      </View>
    </View>
  );
}

/** Saved payment method row. */
export function PaymentMethodRowSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.paymentRow,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <Skeleton width={44} height={32} radius={6} />
      <View style={[styles.flex1Stack, { gap: 6 }]}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="35%" height={12} />
        <Skeleton width="28%" height={10} />
      </View>
      <Skeleton width={36} height={36} radius={18} />
    </View>
  );
}

/** Chat room — alternating message bubbles while history loads. */
export function ChatMessageListSkeleton({ rows = 6 }: { rows?: number }) {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, padding: space.md, gap: space.sm, justifyContent: "flex-end" }}>
      {Array.from({ length: rows }, (_, i) => {
        const mine = i % 2 === 1;
        return (
          <View
            key={i}
            style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              maxWidth: "78%",
            }}
          >
            <Skeleton
              width={mine ? 160 : 200}
              height={i % 3 === 0 ? 48 : 36}
              radius={radii.lg}
              style={{ backgroundColor: c.surfaceMuted }}
            />
          </View>
        );
      })}
    </View>
  );
}

/** Trainer weekly availability tab on Schedule. */
export function TrainerScheduleSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.scheduleHeader}>
        <Skeleton height={22} width={160} />
        <Skeleton height={36} width={120} radius={radii.md} />
      </View>
      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={styles.skeletonSection}>
          <Skeleton height={14} width={110} />
          <View style={{ height: 8 }} />
          <Skeleton height={62} radius={radii.lg} />
          <View style={{ height: 6 }} />
          <Skeleton height={62} radius={radii.lg} />
        </View>
      ))}
    </View>
  );
}

/** “Tips for you” card rows — matches `TipsForYouSection`. */
export function TipsCardSkeleton({ rows = 3 }: { rows?: number }) {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.tipsCard,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.tipsRow, i > 0 && styles.tipsRowBorder, { borderTopColor: c.border }]}>
          <Skeleton width={18} height={18} radius={9} />
          <View style={[styles.flex1Stack, { gap: 6 }]}>
            <Skeleton width="75%" height={13} />
            <Skeleton width="90%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Trainer earnings hero card + action rows. */
export function EarningsCardSkeleton() {
  const c = useThemeColors();
  return (
    <View style={{ gap: space.md, padding: space.lg }}>
      <View
        style={[
          styles.earningsHero,
          { backgroundColor: c.surfaceElevated, borderColor: c.border },
        ]}
      >
        <Skeleton width={140} height={12} />
        <Skeleton width={160} height={32} style={{ marginTop: space.sm }} />
        <Skeleton width="70%" height={11} style={{ marginTop: space.sm }} />
      </View>
      <Skeleton width={120} height={16} />
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Skeleton width="48%" height={44} radius={radii.md} />
        <Skeleton width="48%" height={44} radius={radii.md} />
      </View>
      <Skeleton width={80} height={16} style={{ marginTop: space.sm }} />
      <Skeleton width="100%" height={44} radius={radii.md} />
      <Skeleton width="100%" height={48} radius={radii.md} />
    </View>
  );
}

/** Friend request tiles on dashboard home. */
export function FriendRequestTilesSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View style={styles.friendTilesRow}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.friendTile}>
          <Skeleton width={56} height={56} radius={28} />
          <Skeleton width={72} height={11} style={{ marginTop: 6 }} />
          <View style={{ flexDirection: "row", gap: space.xs, marginTop: space.sm }}>
            <Skeleton width={36} height={28} radius={radii.pill} />
            <Skeleton width={36} height={28} radius={radii.pill} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Blog list card — image + title + excerpt. */
export function BlogCardSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.blogCard,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <Skeleton width="100%" height={160} radius={radii.md} />
      <View style={{ padding: space.md, gap: 8 }}>
        <Skeleton width="85%" height={16} />
        <Skeleton width="100%" height={11} />
        <Skeleton width="60%" height={11} />
      </View>
    </View>
  );
}

/** Transaction / wallet detail — amount header + metadata rows. */
export function TransactionDetailSkeleton() {
  const c = useThemeColors();
  return (
    <View style={{ padding: space.lg, gap: space.md }}>
      <View style={{ alignItems: "center", gap: space.sm, paddingVertical: space.lg }}>
        <Skeleton width={120} height={12} />
        <Skeleton width={180} height={36} />
        <Skeleton width={100} height={24} radius={radii.pill} />
      </View>
      {Array.from({ length: 4 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.txDetailRow,
            { backgroundColor: c.surfaceElevated, borderColor: c.border },
          ]}
        >
          <Skeleton width="35%" height={12} />
          <Skeleton width="50%" height={12} />
        </View>
      ))}
    </View>
  );
}

/**
 * Game plan card — large image/icon area + title + badge strip.
 * Matches the `planCard` layout in `GamePlansScreen`.
 */
export function GamePlanCardSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.gamePlanCard,
        { backgroundColor: c.surfaceElevated, borderColor: c.border },
      ]}
    >
      <Skeleton width="100%" height={152} radius={0} />
      <View style={{ padding: space.md, gap: 8 }}>
        <Skeleton width="85%" height={18} />
        <Skeleton width="50%" height={14} />
        <Skeleton width="40%" height={14} />
      </View>
    </View>
  );
}

/**
 * Notification row — icon circle + title + body + timestamp + unread dot.
 * Matches `NotificationItem` in `NotificationsScreen`.
 */
export function NotificationRowSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        styles.notifRow,
        { backgroundColor: c.surfaceElevated, borderBottomColor: c.border },
      ]}
    >
      {/* 40px icon circle */}
      <Skeleton width={40} height={40} radius={20} style={{ flexShrink: 0 }} />
      <View style={[styles.flex1Stack, { gap: 5 }]}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="85%" height={11} />
        <Skeleton width="30%" height={10} />
      </View>
      {/* unread dot placeholder */}
      <Skeleton width={8} height={8} radius={4} style={{ flexShrink: 0 }} />
    </View>
  );
}

/**
 * Settings page — a section header + N list rows.
 * Used as a page-level skeleton while preferences load.
 */
export function SettingsSectionSkeleton({ rows = 4 }: { rows?: number }) {
  const c = useThemeColors();
  return (
    <View style={{ gap: 0 }}>
      {/* section header */}
      <Skeleton width={120} height={12} style={{ margin: space.md, marginBottom: space.sm }} />
      <View
        style={[
          styles.settingsBlock,
          { backgroundColor: c.surfaceElevated, borderColor: c.border },
        ]}
      >
        {Array.from({ length: rows }, (_, i) => (
          <View
            key={i}
            style={[
              styles.settingsRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
            ]}
          >
            {/* leading icon circle */}
            <Skeleton width={32} height={32} radius={16} />
            <View style={[styles.flex1Stack, { gap: 5 }]}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="35%" height={10} />
            </View>
            {/* trailing control or chevron */}
            <Skeleton width={40} height={24} radius={radii.pill} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Search bar + category chips in marketplace header. */
export function MarketplaceSearchSkeleton() {
  return (
    <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm }}>
      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
        <Skeleton width="55%" height={18} />
        <Skeleton width={44} height={44} radius={22} />
      </View>
      <Skeleton width="100%" height={48} radius={radii.lg} />
      <View style={{ flexDirection: "row", gap: space.md, paddingVertical: space.xs }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ alignItems: "center", width: 64, gap: 6 }}>
            <Skeleton width={52} height={52} radius={26} />
            <Skeleton width={48} height={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Clip list row — 64×64 thumbnail + title + date line.
 * Matches the `clipCard` row layout in `ClipsScreen`.
 */
export function ClipRowSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingVertical: 10,
          paddingHorizontal: space.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
      ]}
    >
      <Skeleton width={64} height={64} radius={radii.sm} style={{ flexShrink: 0 }} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="75%" height={13} />
        <Skeleton width="45%" height={10} />
      </View>
      <Skeleton width={18} height={18} radius={9} style={{ flexShrink: 0 }} />
    </View>
  );
}

/**
 * Category section + rows — section header (icon + title + count pill)
 * followed by 3 `ClipRowSkeleton` rows. Used in the My Clips / Shared / Library tabs.
 */
export function ClipSectionSkeleton({ rows = 3 }: { rows?: number }) {
  const c = useThemeColors();
  return (
    <View
      style={{
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surfaceElevated,
        overflow: "hidden",
        marginBottom: space.sm,
      }}
    >
      {/* Section header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: space.md,
          paddingVertical: 12,
          backgroundColor: c.surfaceMuted,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <Skeleton width={32} height={32} radius={radii.sm} />
          <Skeleton width="50%" height={14} />
          <Skeleton width={28} height={20} radius={radii.pill} />
        </View>
        <Skeleton width={20} height={20} radius={10} />
      </View>
      {/* Clip rows */}
      <View style={{ paddingHorizontal: space.sm }}>
        {Array.from({ length: rows }, (_, i) => (
          <ClipRowSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

/**
 * Friend list row for the share modal — avatar + name + check circle.
 */
export function FriendRowSkeleton() {
  const c = useThemeColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
      }}
    >
      <Skeleton width={40} height={40} radius={20} style={{ flexShrink: 0 }} />
      <Skeleton width="55%" height={14} style={{ flex: 1 }} />
      <Skeleton width={22} height={22} radius={11} style={{ flexShrink: 0 }} />
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
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  offerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
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
  tipsCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  tipsRow: {
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
    alignItems: "flex-start",
  },
  tipsRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  earningsHero: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  friendTilesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    justifyContent: "center",
  },
  friendTile: {
    alignItems: "center",
    padding: space.sm,
    minWidth: 120,
  },
  blogCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  txDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: space.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  walletCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  walletLedgerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.sm,
  },
  scheduleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  skeletonSection: { paddingHorizontal: space.md, paddingTop: space.md },
  promoSkeletonCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space.md,
    marginBottom: space.sm,
  },
  promoSkeletonTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
  promoSkeletonActions: {
    flexDirection: "row",
    gap: space.lg,
  },
  gamePlanCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsBlock: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginHorizontal: space.md,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: space.sm,
  },
});
