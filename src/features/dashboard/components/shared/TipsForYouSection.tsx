import React, { useCallback, useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TrainerScheduleDay } from "../../../home/api/homeApi";
import { type Tip } from "../../../content/api/contentApi";
import { useCmsHomeTips } from "../../../content/hooks/useCmsHome";
import { isReactNavigationDeepLink } from "../../../content/lib/deepLinks";
import { countSlotsNextWeek, hasThursdaySlot } from "../../lib/trainerSlotUtils";
import { useAuth } from "../../../auth/context/AuthContext";
import { TipsCardSkeleton } from "../../../../components/ui";
import { DashboardSection } from "./DashboardSection";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type TrainerContext = {
  pendingCount: number;
  showAsOnline: boolean;
  scheduleSlots: TrainerScheduleDay[];
};

type Props = {
  guest?: boolean;
  onDeepLink?: (url: string) => void;
  /** When set, appends trainer-specific performance tips after admin tips. */
  trainerContext?: TrainerContext;
};

type Row =
  | { kind: "admin"; tip: Tip }
  | { kind: "context"; text: string };

/**
 * Single “Tips for you” block — admin CMS tips plus optional in-app contextual tips.
 */
export function TipsForYouSection({ guest = false, onDeepLink, trainerContext }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const { status } = useAuth();

  const {
    data: adminTips = [],
    isLoading,
    isError,
    refetch,
  } = useCmsHomeTips(guest, {
    enabled: guest || status === "signedIn",
    refetchOnMount: "always",
  });

  const contextualTips = useMemo(() => {
    if (!trainerContext) return [];
    const out: string[] = [];
    const { pendingCount, showAsOnline, scheduleSlots } = trainerContext;
    if (pendingCount > 0) {
      out.push(t("trainerDashboard.tipPendingRequests", { count: pendingCount }));
    }
    if (!hasThursdaySlot(scheduleSlots)) {
      out.push(t("trainerDashboard.tipAddSlots"));
    } else if (countSlotsNextWeek(scheduleSlots) < 3) {
      out.push(t("trainerDashboard.tipAddSlots"));
    }
    if (!showAsOnline) {
      out.push(t("trainerDashboard.tipGoLive"));
    }
    return out.slice(0, 3);
  }, [trainerContext, t]);

  const rows = useMemo<Row[]>(() => {
    const seen = new Set<string>();
    const admin: Row[] = [];
    for (const tip of adminTips) {
      const key = String(tip._id ?? `${tip.title ?? ""}-${tip.body ?? ""}`).trim();
      if (!key) {
        admin.push({ kind: "admin", tip });
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      admin.push({ kind: "admin", tip });
    }
    const context: Row[] = contextualTips.map((text) => ({ kind: "context", text }));
    return [...admin, ...context];
  }, [adminTips, contextualTips]);

  const openTip = useCallback(
    (tip: Tip) => {
      if (!tip.cta_url) return;
      if (isReactNavigationDeepLink(tip.cta_url) && onDeepLink) {
        onDeepLink(tip.cta_url);
        return;
      }
      Linking.openURL(tip.cta_url).catch(() => {});
    },
    [onDeepLink]
  );

  const showSection = guest || status === "signedIn";
  if (!showSection) return null;

  const title = t("trainerDashboard.performanceTips", {
    defaultValue: t("tips.heading", { defaultValue: "Tips for you" }),
  });

  if (isLoading) {
    return (
      <DashboardSection embedded title={title}>
        <TipsCardSkeleton rows={3} />
      </DashboardSection>
    );
  }

  if (rows.length === 0) {
    if (isError) {
      return (
        <DashboardSection embedded title={title}>
          <Pressable
            onPress={() => void refetch()}
            style={styles.card}
            accessibilityRole="button"
          >
            <View style={styles.row}>
              <Ionicons name="refresh-outline" size={18} color={c.brandNavy} />
              <Text style={styles.text}>
                {t("tips.loadError", {
                  defaultValue: "Could not load tips. Tap to try again.",
                })}
              </Text>
            </View>
          </Pressable>
        </DashboardSection>
      );
    }
    return null;
  }

  return (
    <DashboardSection embedded title={title}>
      <View style={styles.card}>
        {rows.map((row, i) => {
          if (row.kind === "context") {
            return (
              <View key={`ctx-${i}`} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Ionicons name="bulb-outline" size={18} color={c.brandNavy} />
                <Text style={styles.text}>{row.text}</Text>
              </View>
            );
          }

          const { tip } = row;
          const tappable = !!tip.cta_url;
          const Wrapper = tappable ? Pressable : View;
          const iconName =
            typeof tip.icon === "string" && tip.icon in Ionicons.glyphMap
              ? (tip.icon as keyof typeof Ionicons.glyphMap)
              : "bulb-outline";

          return (
            <Wrapper
              key={`${String(tip._id ?? "admin")}-${i}`}
              onPress={tappable ? () => openTip(tip) : undefined}
              style={[styles.row, i > 0 && styles.rowBorder, tappable && styles.tappable]}
              accessibilityRole={tappable ? "button" : "text"}
              accessibilityLabel={tip.title}
            >
              <Ionicons name={iconName} size={18} color={c.brandNavy} />
              <View style={styles.copy}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                {tip.body ? <Text style={styles.tipBody}>{tip.body}</Text> : null}
                {tip.cta_label ? (
                  <Text style={styles.cta}>{tip.cta_label}</Text>
                ) : null}
              </View>
              {tappable ? (
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              ) : null}
            </Wrapper>
          );
        })}
      </View>
    </DashboardSection>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        overflow: "hidden",
      },
      row: {
        flexDirection: "row",
        gap: space.sm,
        padding: space.md,
        alignItems: "flex-start",
      },
      rowBorder: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
      },
      tappable: { alignItems: "center" },
      copy: { flex: 1, minWidth: 0 },
      text: { ...typography.bodySm, color: palette.text, flex: 1 },
      tipTitle: { ...typography.bodySm, fontWeight: "600", color: palette.text },
      tipBody: {
        ...typography.bodySm,
        color: palette.textSecondary,
        marginTop: 4,
        lineHeight: 20,
      },
      cta: {
        ...typography.label,
        color: palette.brandNavy,
        marginTop: 6,
      },
      loadingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
      },
    })
  );
}
