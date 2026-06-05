import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { AccountType } from "../../../constants/accountType";
import { RatingsModal } from "../../calling/components/RatingsModal";
import {
  consumePendingSessionRating,
  dismissRatingBanner,
  hasShownSessionRating,
  isRatingBannerDismissed,
  markSessionRatingShown,
} from "../../calling/postSessionRatingStore";
import { shouldOfferSessionRating } from "../../../lib/sessions/shouldOfferSessionRating";
import { hasViewerRated } from "../../../lib/sessions/sessionRatingUtils";
import { queryKeys } from "../../../lib/queryKeys";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";

type Props = {
  session: Record<string, unknown>;
  accountType: string | null;
  otherPartyName?: string;
  /** Upcoming / live sessions — suppress rating while any lesson is in progress. */
  activeSessions?: Array<Record<string, unknown>>;
};

/**
 * Surfaces on the home dashboard when a recent lesson has no rating yet.
 * Catches users who skipped the in-call modal or left before submitting.
 */
export function PostSessionRatingBanner({
  session,
  accountType,
  otherPartyName,
  activeSessions,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const sessionId = String(session._id ?? session.id ?? "");
  const isTrainer = accountType === AccountType.TRAINER;
  const alreadyRated = hasViewerRated(session, isTrainer);
  const eligible = shouldOfferSessionRating(session, isTrainer, { activeSessions });

  const [hidden, setHidden] = useState(alreadyRated);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!sessionId || alreadyRated) return;
    let cancelled = false;
    void (async () => {
      const dismissed = await isRatingBannerDismissed(sessionId);
      if (cancelled || dismissed) {
        setHidden(true);
        return;
      }
      const pending = await consumePendingSessionRating();
      if (!cancelled && pending === sessionId) {
        setModalOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, alreadyRated]);

  const handleDismiss = useCallback(() => {
    void dismissRatingBanner(sessionId);
    setHidden(true);
  }, [sessionId]);

  const handleRated = useCallback(() => {
    void markSessionRatingShown(sessionId);
    setHidden(true);
    setModalOpen(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.scheduledMeetings });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
  }, [queryClient, sessionId]);

  if (hidden || !eligible || !sessionId) return null;

  const name = otherPartyName?.trim() || t("postSessionRating.coachFallback", { defaultValue: "your coach" });

  return (
    <>
      <View style={styles.banner}>
        <Ionicons name="star-outline" size={22} color={c.brandNavy} />
        <View style={styles.textCol}>
          <Text style={styles.title}>
            {t("postSessionRating.title", { defaultValue: "Rate your lesson" })}
          </Text>
          <Text style={styles.sub}>
            {t("postSessionRating.body", {
              name,
              defaultValue: "How was your session with {{name}}? It only takes a moment.",
            })}
          </Text>
        </View>
        <Pressable
          style={styles.cta}
          onPress={() => setModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("postSessionRating.rateA11y", { defaultValue: "Rate session" })}
        >
          <Text style={styles.ctaText}>
            {t("postSessionRating.rate", { defaultValue: "Rate" })}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityLabel={t("postSessionRating.dismissA11y", { defaultValue: "Dismiss" })}
        >
          <Ionicons name="close" size={20} color={c.textMuted} />
        </Pressable>
      </View>
      <RatingsModal
        visible={modalOpen}
        bookingId={sessionId}
        accountType={accountType}
        isFromCall
        onClose={() => setModalOpen(false)}
        onSkip={handleDismiss}
        onSubmitted={handleRated}
      />
    </>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      banner: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        marginHorizontal: space.md,
        marginBottom: space.md,
        padding: space.md,
        borderRadius: radii.md,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.borderFocus,
      },
      textCol: { flex: 1 },
      title: { ...typography.bodyMd, fontWeight: "700", color: palette.text },
      sub: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      cta: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.sm,
        backgroundColor: palette.brandNavy,
      },
      ctaText: { ...typography.caption, fontWeight: "700", color: palette.brandTextOn },
    })
  );
}
