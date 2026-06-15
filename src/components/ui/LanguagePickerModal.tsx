import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { APP_LANGUAGES } from "../../i18n/languages";
import { haptics } from "../../lib/haptics";
import { radii, space, typography } from "../../theme";
import { useThemeColors } from "../../theme";

type Props = {
  visible: boolean;
  selectedCode: string;
  onClose: () => void;
  onSelect: (code: string) => void;
};

export function LanguagePickerModal({ visible, selectedCode, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: c.surfaceElevated },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[typography.titleSm, { color: c.text, marginBottom: space.sm }]}>
            {t("settings.language")}
          </Text>
          {APP_LANGUAGES.map((lang) => {
            const on = lang.code === selectedCode;
            return (
              <Pressable
                key={lang.code}
                onPress={() => {
                  haptics.select();
                  onSelect(lang.code);
                  onClose();
                }}
                style={[
                  styles.row,
                  on && { backgroundColor: c.brandAccentSubtle },
                ]}
              >
                <Text
                  style={[
                    typography.bodyMd,
                    { color: on ? c.brandNavy : c.text, fontWeight: on ? "700" : "500" },
                  ]}
                >
                  {lang.label}
                </Text>
                {on ? <Ionicons name="checkmark-circle" size={22} color={c.brandAccent} /> : null}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              haptics.tap();
              onClose();
            }}
            style={[styles.closeBtn, { marginTop: space.sm, backgroundColor: c.surfaceMuted }]}
          >
            <Text style={[typography.bodyMd, { fontWeight: "700", color: c.textSecondary }]}>
              {t("common.close")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: space.lg },
  card: { borderRadius: radii.lg, padding: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
  },
  closeBtn: { paddingVertical: 12, borderRadius: radii.sm, alignItems: "center" },
});
