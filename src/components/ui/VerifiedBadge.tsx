/**
 * VerifiedBadge — explains what the blue check actually means.
 *
 * On the web a tooltip is enough; on mobile we open a small bottom sheet
 * the first time the user taps the badge (and every subsequent tap if they
 * want a refresher). The intent is to *build trainer trust*: who issued the
 * verification, what was verified, when, and what it doesn't promise.
 *
 * Usage:
 *   <VerifiedBadge size={16} />
 *   <VerifiedBadge size={18} reviewedAt={user.verified_at} />
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { radii, space, typography, useThemeColors } from "../../theme";
import { Button } from "./Button";

export type VerifiedBadgeProps = {
  /** Pixel size of the icon (default 14). The tap target is min 24×24 regardless. */
  size?: number;
  /** Optional ISO date string — surfaced in the explanation sheet. */
  reviewedAt?: string | null;
  /** Hide the tap-to-explain sheet (rarely needed; useful for tooltips inside
   *  read-only contexts). */
  noTooltip?: boolean;
  /** Tint override — defaults to brandAccent / success. */
  tint?: string;
};

export function VerifiedBadge({ size = 14, reviewedAt, noTooltip, tint }: VerifiedBadgeProps) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => {
    if (!noTooltip) setOpen(true);
  }, [noTooltip]);

  const handleClose = useCallback(() => setOpen(false), []);

  const reviewedLabel =
    reviewedAt && Number.isFinite(new Date(reviewedAt).getTime())
      ? new Date(reviewedAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <>
      <Pressable
        onPress={handleOpen}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("verified.accessibility", {
          defaultValue: "Verified trainer — tap to learn what verification means",
        })}
        style={({ pressed }) => [
          {
            width: Math.max(size + 6, 24),
            height: Math.max(size + 6, 24),
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={size} color={tint ?? c.brandAccent} />
      </Pressable>

      {!noTooltip ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={handleClose}
        >
          <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={handleClose}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={[
                styles.sheet,
                {
                  backgroundColor: c.surfaceElevated,
                  borderColor: c.border,
                },
              ]}
            >
              <View style={styles.header}>
                <View style={[styles.iconWrap, { backgroundColor: c.brandAccentSubtle }]}>
                  <Ionicons name="checkmark-circle" size={28} color={c.brandAccent} />
                </View>
                <Text style={[typography.titleMd, { color: c.text }]}>
                  {t("verified.title", { defaultValue: "Verified trainer" })}
                </Text>
              </View>

              <Text style={[typography.bodyMd, { color: c.textSecondary, marginTop: space.sm }]}>
                {t("verified.summary", {
                  defaultValue:
                    "NetQwix manually reviewed this trainer's identity, credentials, and contact details before granting the badge.",
                })}
              </Text>

              <View style={[styles.bulletRow, { marginTop: space.md }]}>
                <Ionicons name="person-outline" size={18} color={c.iconPrimary} />
                <Text style={[typography.bodySm, { color: c.textSecondary, flex: 1 }]}>
                  {t("verified.bulletIdentity", {
                    defaultValue: "Government-issued ID confirmed against the trainer's profile.",
                  })}
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="ribbon-outline" size={18} color={c.iconPrimary} />
                <Text style={[typography.bodySm, { color: c.textSecondary, flex: 1 }]}>
                  {t("verified.bulletCredentials", {
                    defaultValue:
                      "Certifications, work history, and education claims were reviewed for authenticity.",
                  })}
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Ionicons name="mail-outline" size={18} color={c.iconPrimary} />
                <Text style={[typography.bodySm, { color: c.textSecondary, flex: 1 }]}>
                  {t("verified.bulletContact", {
                    defaultValue: "Email and phone number confirmed via one-time codes.",
                  })}
                </Text>
              </View>

              <View
                style={[
                  styles.disclaimer,
                  { backgroundColor: c.warningSubtle, borderColor: c.warning },
                ]}
              >
                <Ionicons name="information-circle-outline" size={18} color={c.warningText} />
                <Text style={[typography.bodySm, { color: c.warningText, flex: 1 }]}>
                  {t("verified.disclaimer", {
                    defaultValue:
                      "Verification confirms identity and stated credentials. It does not guarantee outcomes or substitute for your own due diligence.",
                  })}
                </Text>
              </View>

              {reviewedLabel ? (
                <Text style={[typography.caption, { color: c.textMuted, marginTop: space.sm }]}>
                  {t("verified.reviewedOn", {
                    defaultValue: "Reviewed on {{date}}",
                    date: reviewedLabel,
                  })}
                </Text>
              ) : null}

              <View style={{ marginTop: space.md }}>
                <Button
                  label={t("common.done", { defaultValue: "Done" })}
                  onPress={handleClose}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: space.lg,
    paddingBottom: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletRow: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "flex-start",
    paddingVertical: 6,
  },
  disclaimer: {
    marginTop: space.md,
    padding: space.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
});
