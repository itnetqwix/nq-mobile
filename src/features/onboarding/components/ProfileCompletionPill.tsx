/**
 * Profile-completion pill + missing-fields sheet.
 *
 * Shown on the dashboard for both roles until the user hits 100 %. Tapping
 * the pill opens a sheet listing every remaining step with a one-tap
 * "Complete" button that routes to the right surface. Crucially:
 *
 *   • The pill collapses to nothing at 100 % so it doesn't take up
 *     real estate forever.
 *   • The user can permanently dismiss it (we still surface the missing
 *     items inside Settings — this is just dashboard nudging).
 *   • Trainer missing items rank higher (sport, rate, availability) so
 *     unfinished accounts never land in browse results.
 */

import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/context/AuthContext";
import type { HomeStackParamList } from "../../../navigation/types";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { Sheet } from "../../../components/ui";
import {
  computeProfileCompletion,
  type ProfileCompletionAction,
  type ProfileCompletionStep,
} from "../profileCompletion";

const DISMISS_KEY = "nq.profile-completion.dismissed";

export type ProfileCompletionPillProps = {
  /** When set, hides the pill above this score (default 100). Useful for
   *  tests / debugging — never lower in production code. */
  hideAtOrAbove?: number;
  /** Optional callback fired when user taps "Complete" on any step. */
  onStepPress?: (step: ProfileCompletionStep) => void;
};

export function ProfileCompletionPill({
  hideAtOrAbove = 100,
  onStepPress,
}: ProfileCompletionPillProps) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { user, accountType } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    void SecureStore.getItemAsync(DISMISS_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const at = Number(raw);
        if (Number.isFinite(at) && Date.now() - at < 14 * 24 * 60 * 60 * 1000) {
          /**
           * Honour a 14-day "snooze" — long enough that the user isn't
           * pestered every launch, short enough to surface again if
           * they keep skipping. After two weeks the pill returns.
           */
          setDismissed(true);
        } else {
          setDismissed(false);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [user]);

  const completion = useMemo(
    () =>
      computeProfileCompletion(
        (user as Record<string, unknown> | null) ?? null,
        accountType
      ),
    [user, accountType]
  );

  const styles = useThemedStyles((p) =>
    StyleSheet.create({
      pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: radii.pill,
        backgroundColor: p.brandAccentSubtle,
        borderWidth: 1,
        borderColor: p.brandAccent,
      },
      track: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: p.borderSubtle,
        overflow: "hidden",
      },
      trackFill: {
        height: "100%",
        backgroundColor: p.brandAccent,
        borderRadius: 3,
      },
      ringWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: p.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
      },
      stepRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.sm,
      },
      stepIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
      },
      cta: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: p.brandAccent,
        backgroundColor: p.surfaceElevated,
      },
      divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: p.border,
        marginLeft: 52,
      },
      doneRow: { opacity: 0.55 },
      footerBtn: {
        padding: space.sm,
        alignItems: "center",
        marginTop: space.sm,
      },
    })
  );

  if (dismissed || !accountType) return null;
  if (completion.score >= hideAtOrAbove) return null;

  const handleStep = useCallback(
    (step: ProfileCompletionStep) => {
      setOpen(false);
      onStepPress?.(step);
      runAction(step.cta, navigation);
    },
    [navigation, onStepPress]
  );

  const handleSnooze = useCallback(async () => {
    setDismissed(true);
    setOpen(false);
    try {
      await SecureStore.setItemAsync(DISMISS_KEY, String(Date.now()));
    } catch {
      /* non-blocking */
    }
  }, []);

  const handlePillPress = () => setOpen(true);
  const nextStep = completion.nextStep;

  return (
    <>
      <Pressable
        onPress={handlePillPress}
        accessibilityRole="button"
        accessibilityLabel={t("profileCompletion.pillA11y", {
          defaultValue: "Profile is {{pct}} percent complete. Tap to see what's missing.",
          pct: completion.score,
        })}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.ringWrap}>
          <Text style={[typography.label, { color: c.brandAccent, fontSize: 12 }]}>
            {completion.score}%
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[typography.subtitle, { color: c.text }]} numberOfLines={1}>
            {t("profileCompletion.title", {
              defaultValue: "Profile {{pct}}% complete",
              pct: completion.score,
            })}
          </Text>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${completion.score}%` }]} />
          </View>
          {nextStep ? (
            <Text style={[typography.caption, { color: c.textMuted }]} numberOfLines={1}>
              {t("profileCompletion.next", {
                defaultValue: "Next: {{label}}",
                label: nextStep.label,
              })}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.brandAccent} />
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t("profileCompletion.sheetTitle", { defaultValue: "Finish your profile" })}
        description={t("profileCompletion.sheetDescription", {
          defaultValue: "Each step boosts how trainees and trainers see you on NetQwix.",
        })}
        showClose
      >
        <ScrollView style={{ maxHeight: 480 }}>
          {completion.steps.map((step, idx) => {
            const i18nLabel = t(`profileCompletion.steps.${step.id}.label`, {
              defaultValue: step.label,
            });
            const i18nHint = t(`profileCompletion.steps.${step.id}.hint`, {
              defaultValue: step.hint,
            });
            return (
              <React.Fragment key={step.id}>
                {idx > 0 ? <View style={styles.divider} /> : null}
                <View style={[styles.stepRow, step.done && styles.doneRow]}>
                  <View
                    style={[
                      styles.stepIcon,
                      {
                        backgroundColor: step.done ? c.successSubtle : c.brandAccentSubtle,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        step.done
                          ? "checkmark"
                          : (step.icon as keyof typeof import("@expo/vector-icons").Ionicons.glyphMap)
                      }
                      size={18}
                      color={step.done ? c.success : c.brandAccent}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.subtitle,
                        {
                          color: step.done ? c.textMuted : c.text,
                          textDecorationLine: step.done ? "line-through" : "none",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {i18nLabel}
                    </Text>
                    <Text
                      style={[typography.caption, { color: c.textMuted, marginTop: 2 }]}
                      numberOfLines={2}
                    >
                      {i18nHint}
                    </Text>
                  </View>
                  {!step.done ? (
                    <Pressable
                      onPress={() => handleStep(step)}
                      style={styles.cta}
                      accessibilityRole="button"
                      accessibilityLabel={t("profileCompletion.completeA11y", {
                        defaultValue: "Complete {{label}}",
                        label: i18nLabel,
                      })}
                    >
                      <Text style={[typography.label, { color: c.brandAccent }]}>
                        {t("profileCompletion.complete", { defaultValue: "Complete" })}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </React.Fragment>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={handleSnooze}
          style={styles.footerBtn}
          accessibilityRole="button"
          accessibilityLabel={t("profileCompletion.snoozeA11y", {
            defaultValue: "Hide this pill for two weeks",
          })}
        >
          <Text style={[typography.label, { color: c.textMuted }]}>
            {t("profileCompletion.snooze", { defaultValue: "Remind me later" })}
          </Text>
        </Pressable>
      </Sheet>
    </>
  );
}

function runAction(
  action: ProfileCompletionAction,
  navigation: NativeStackNavigationProp<HomeStackParamList>
): void {
  switch (action.kind) {
    case "shell":
      navigation.navigate("ShellSurface", { surfaceId: action.surfaceId });
      return;
    case "feature":
      navigation.navigate("DashboardFeature", { featureId: action.featureId });
      return;
    case "settings-section":
      navigation.navigate("ShellSurface", { surfaceId: "settings" });
      return;
  }
}
