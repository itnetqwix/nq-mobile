import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LockerClip } from "../api/clipsApi";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

type Props = {
  visible: boolean;
  clip: LockerClip | null;
  onClose: () => void;
};

function sharerName(clip: LockerClip, fallback: string): string {
  const sharer = clip.sharer as Record<string, unknown> | undefined;
  const name = sharer?.fullname ?? sharer?.fullName;
  return name ? String(name) : fallback;
}

function sharedWhen(clip: LockerClip): string {
  const raw = clip.shared_at ?? clip.createdAt;
  if (!raw) return "";
  return new Date(String(raw)).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SharedClipInfoSheet({ visible, clip, onClose }: Props) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useStyles();

  if (!clip) return null;

  const name = sharerName(clip, t("locker.friendDefault"));
  const when = sharedWhen(clip);
  const title = String(clip.title ?? clip.file_name ?? t("locker.clipDefault"));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.iconRow}>
            <View style={[styles.iconCircle, { backgroundColor: c.brandSubtle }]}>
              <Ionicons name="information-circle" size={28} color={c.brandNavy} />
            </View>
          </View>
          <Text style={styles.heading}>
            {t("locker.sharedClipInfoTitle", { defaultValue: "Shared video" })}
          </Text>
          <Text style={styles.clipTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.factRow}>
            <Ionicons name="person-outline" size={18} color={c.textMuted} />
            <View style={styles.factBody}>
              <Text style={styles.factLabel}>
                {t("locker.sharedClipInfoBy", { defaultValue: "Shared by" })}
              </Text>
              <Text style={styles.factValue}>{name}</Text>
            </View>
          </View>
          {when ? (
            <View style={styles.factRow}>
              <Ionicons name="time-outline" size={18} color={c.textMuted} />
              <View style={styles.factBody}>
                <Text style={styles.factLabel}>
                  {t("locker.sharedClipInfoWhen", { defaultValue: "Shared on" })}
                </Text>
                <Text style={styles.factValue}>{when}</Text>
              </View>
            </View>
          ) : null}
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t("common.close")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
      },
      sheet: {
        backgroundColor: palette.surfaceElevated,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingHorizontal: space.lg,
        paddingTop: space.lg,
        gap: space.sm,
      },
      iconRow: { alignItems: "center", marginBottom: space.xs },
      iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
      },
      heading: {
        ...typography.titleSm,
        color: palette.text,
        fontWeight: "800",
        textAlign: "center",
      },
      clipTitle: {
        ...typography.bodySm,
        color: palette.textMuted,
        textAlign: "center",
        marginBottom: space.sm,
      },
      factRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        paddingVertical: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
      },
      factBody: { flex: 1, gap: 2 },
      factLabel: { ...typography.caption, color: palette.textMuted },
      factValue: { ...typography.bodyMd, color: palette.text, fontWeight: "600" },
      closeBtn: {
        marginTop: space.md,
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: "center",
      },
      closeBtnText: { ...typography.bodyMd, color: palette.brandTextOn, fontWeight: "700" },
    })
  );
}
