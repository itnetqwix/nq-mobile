import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import type { TrainerScheduleDay } from "../../../home/api/homeApi";
import { fetchHomeTips, type Tip } from "../../../content/api/contentApi";
import { isReactNavigationDeepLink } from "../../../content/lib/deepLinks";
import { countSlotsNextWeek, hasThursdaySlot } from "../../lib/trainerSlotUtils";
import { queryKeys } from "../../../../lib/queryKeys";
import { useAuth } from "../../../auth/context/AuthContext";
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
  } = useQuery({
    queryKey: [...queryKeys.content.tips, guest ? "guest" : "auth"] as const,
    queryFn: () => fetchHomeTips({ guest }),
    enabled: guest || status === "signedIn",
    staleTime: 2 * 60_000,
    refetchOnMount: "always",
    retry: 2,
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
    const admin: Row[] = adminTips.map((tip) => ({ kind: "admin", tip }));
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
        <View style={styles.card}>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={c.brandNavy} />
            <Text style={[styles.text, { color: c.textMuted }]}>
              {t("common.loading", { defaultValue: "Loading…" })}
            </Text>
          </View>
        </View>
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

          return (
            <Wrapper
              key={tip._id ?? `admin-${i}`}
              onPress={tappable ? () => openTip(tip) : undefined}
              style={[styles.row, i > 0 && styles.rowBorder, tappable && styles.tappable]}
              accessibilityRole={tappable ? "button" : "text"}
              accessibilityLabel={tip.title}
            >
              <Ionicons
                name={(tip.icon as keyof typeof Ionicons.glyphMap) || "bulb-outline"}
                size={18}
                color={c.brandNavy}
              />
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
