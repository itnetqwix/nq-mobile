import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { AuthEscapeLink } from "../../auth/components/AuthEscapeLink";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import {
  radii,
  space,
  typography,
  useThemeColors,
  useThemedStyles,
} from "../../../theme";
import { Button } from "../../../components/ui";
import { haptics } from "../../../lib/haptics";
import { getVerificationStatus, type OnboardingStatus } from "../verificationApi";

type Props = { onApproved: () => void };

type StepKey = "submitted" | "underReview" | "approved";

const POLL_INTERVAL_MS = 30_000;

/**
 * Trainer / trainee verification holding screen shown after they submit and
 * before an admin approves them. We poll the server every 30s in the
 * background (unchanged) but also expose:
 *  - A timeline so the user understands which stage they are in.
 *  - A manual "Check status now" button for impatient retries.
 *  - A "Contact support" link to email the team.
 *  - A "Sign out" affordance via the existing AuthEscapeLink.
 */
export function PendingReviewScreen({ onApproved }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshNow = useCallback(
    async (manual: boolean) => {
      if (manual) {
        setChecking(true);
        setLastError(null);
        haptics.select();
      }
      try {
        const s = await getVerificationStatus();
        setStatus(s);
        setLastCheckedAt(new Date());
        if (s.step === "completed" && s.status === "approved") {
          haptics.success();
          onApproved();
        } else if (manual) {
          haptics.success();
        }
      } catch (err: unknown) {
        if (manual) {
          haptics.error();
          const message =
            err instanceof Error
              ? err.message
              : t("pendingReview.checkError", {
                  defaultValue: "Could not refresh status. Try again.",
                });
          setLastError(String(message));
        }
      } finally {
        if (manual) setChecking(false);
      }
    },
    [onApproved, t]
  );

  useEffect(() => {
    // Initial fetch so the timeline is accurate the first time the screen mounts.
    void refreshNow(false);
    const t = setInterval(() => void refreshNow(false), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [refreshNow]);

  const currentStep: StepKey = useMemo(() => {
    if (!status) return "underReview";
    if (status.status === "approved") return "approved";
    if (status.status === "rejected") return "underReview";
    return status.step === "completed" ? "approved" : "underReview";
  }, [status]);

  const isRejected = status?.status === "rejected";

  const contactSupport = useCallback(() => {
    const url = "mailto:support@netqwix.com?subject=Verification status";
    void Linking.openURL(url).catch(() => {
      Alert.alert(
        t("pendingReview.contactSupport", { defaultValue: "Contact support" }),
        t("pendingReview.contactSupportFallback", {
          defaultValue: "Email us at support@netqwix.com",
        })
      );
    });
  }, [t]);

  const formatLastChecked = (d: Date | null): string => {
    if (!d) return "";
    const seconds = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
    if (seconds < 60) return t("pendingReview.justChecked", { defaultValue: "just now" });
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return t("pendingReview.minutesAgo", {
        defaultValue: "{{n}} min ago",
        n: minutes,
      });
    }
    return d.toLocaleTimeString();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.escapeRow}>
        <AuthEscapeLink variant="signout" />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + space.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroCircle}>
          <Ionicons
            name={isRejected ? "alert-circle" : "shield-checkmark-outline"}
            size={64}
            color={isRejected ? c.danger : c.brandNavy}
          />
        </View>
        <Text style={[styles.title, { color: c.text }]}>
          {isRejected
            ? t("pendingReview.titleRejected", {
                defaultValue: "Your application needs attention",
              })
            : t("pendingReview.title", { defaultValue: "You're under review" })}
        </Text>
        <Text style={[styles.body, { color: c.textMuted }]}>
          {isRejected
            ? status?.rejection_reason ||
              t("pendingReview.bodyRejected", {
                defaultValue:
                  "We couldn't approve your application. Tap Contact support to learn more.",
              })
            : t("pendingReview.body", {
                defaultValue:
                  "We received your application. Most reviews finish within 48 hours and you'll be notified by email.",
              })}
        </Text>

        {/* Timeline */}
        <View style={styles.timeline}>
          <TimelineStep
            label={t("pendingReview.stepSubmitted", { defaultValue: "Submitted" })}
            description={t("pendingReview.stepSubmittedHint", {
              defaultValue: "Documents received",
            })}
            state="done"
            isFirst
          />
          <TimelineStep
            label={t("pendingReview.stepUnderReview", {
              defaultValue: "Under review",
            })}
            description={t("pendingReview.stepUnderReviewHint", {
              defaultValue: "Usually within 48 hours",
            })}
            state={currentStep === "approved" ? "done" : "active"}
          />
          <TimelineStep
            label={t("pendingReview.stepApproved", { defaultValue: "Approved" })}
            description={t("pendingReview.stepApprovedHint", {
              defaultValue: "You can start coaching",
            })}
            state={currentStep === "approved" ? "done" : "pending"}
            isLast
          />
        </View>

        {/* Status pill */}
        <View style={styles.statusPillWrap}>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isRejected
                    ? c.danger
                    : currentStep === "approved"
                      ? c.success
                      : c.warning,
                },
              ]}
            />
            <Text style={styles.statusPillText}>
              {lastCheckedAt
                ? t("pendingReview.lastCheckedAt", {
                    defaultValue: "Last checked {{when}}",
                    when: formatLastChecked(lastCheckedAt),
                  })
                : t("pendingReview.fetching", {
                    defaultValue: "Fetching status...",
                  })}
            </Text>
          </View>
        </View>

        {lastError ? (
          <Text style={[styles.errorText, { color: c.danger }]}>{lastError}</Text>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label={
              checking
                ? t("pendingReview.checking", { defaultValue: "Checking..." })
                : t("pendingReview.checkNow", {
                    defaultValue: "Check status now",
                  })
            }
            onPress={() => void refreshNow(true)}
            disabled={checking}
            leftIcon="refresh"
          />
          <Pressable
            onPress={contactSupport}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { borderColor: c.borderSubtle },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubbles-outline" size={16} color={c.brandNavy} />
            <Text style={[styles.secondaryBtnText, { color: c.brandNavy }]}>
              {t("pendingReview.contactSupport", {
                defaultValue: "Contact support",
              })}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footnote, { color: c.textMuted }]}>
          {t("pendingReview.footnote", {
            defaultValue:
              "You can close the app — we'll email you the moment your account is approved.",
          })}
        </Text>
      </ScrollView>
    </View>
  );
}

function TimelineStep({
  label,
  description,
  state,
  isFirst,
  isLast,
}: {
  label: string;
  description: string;
  state: "done" | "active" | "pending";
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const c = useThemeColors();
  const styles = useStyles();
  const dotColor =
    state === "done" ? c.success : state === "active" ? c.brandNavy : c.borderSubtle;
  const ringColor =
    state === "active" ? c.brandSubtle : "transparent";
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        {isFirst ? <View style={{ width: 2, flex: 0 }} /> : (
          <View style={[styles.railSegment, { backgroundColor: state === "pending" ? c.borderSubtle : c.success }]} />
        )}
        <View style={[styles.dotRing, { backgroundColor: ringColor }]}>
          <View style={[styles.dot, { backgroundColor: dotColor }]}>
            {state === "done" ? (
              <Ionicons name="checkmark" size={12} color={c.brandTextOn} />
            ) : null}
          </View>
        </View>
        {isLast ? <View style={{ width: 2, flex: 1 }} /> : (
          <View style={[styles.railSegment, { backgroundColor: state === "done" ? c.success : c.borderSubtle }]} />
        )}
      </View>
      <View style={styles.timelineCopy}>
        <Text style={[styles.timelineLabel, { color: c.text }]}>{label}</Text>
        <Text style={[styles.timelineDescription, { color: c.textMuted }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: {
        flex: 1,
        backgroundColor: palette.background,
        paddingHorizontal: space.md,
      },
      escapeRow: { alignItems: "flex-end" },
      scrollContent: {
        flexGrow: 1,
        paddingHorizontal: space.sm,
        paddingTop: space.md,
        gap: space.md,
      },
      heroCircle: {
        alignSelf: "center",
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      title: {
        ...typography.titleLg,
        textAlign: "center",
        fontWeight: "800",
      },
      body: {
        ...typography.bodyMd,
        textAlign: "center",
        lineHeight: 22,
        paddingHorizontal: space.sm,
      },
      timeline: {
        marginTop: space.sm,
        paddingHorizontal: space.sm,
        gap: 0,
      },
      timelineRow: {
        flexDirection: "row",
        alignItems: "stretch",
        gap: space.sm,
        minHeight: 64,
      },
      timelineRail: {
        width: 24,
        alignItems: "center",
      },
      railSegment: { width: 2, flex: 1, marginVertical: 2 },
      dotRing: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
      },
      dot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
      },
      timelineCopy: { flex: 1, paddingVertical: space.xs },
      timelineLabel: { ...typography.bodyMd, fontWeight: "700" },
      timelineDescription: { ...typography.caption, marginTop: 2 },
      statusPillWrap: { alignItems: "center" },
      statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radii.pill,
      },
      statusDot: { width: 8, height: 8, borderRadius: 4 },
      statusPillText: { ...typography.caption, color: palette.textMuted, fontWeight: "600" },
      errorText: { ...typography.caption, textAlign: "center" },
      actions: { gap: space.sm, marginTop: space.sm },
      secondaryBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        borderRadius: radii.md,
        borderWidth: 1,
      },
      secondaryBtnText: { ...typography.label, fontWeight: "700" },
      footnote: {
        ...typography.caption,
        textAlign: "center",
        marginTop: space.sm,
      },
    })
  );
}
