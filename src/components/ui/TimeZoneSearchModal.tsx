import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { IANA_TIME_ZONES } from "../../lib/timeZones";
import { radii, space, typography } from "../../theme";
import { useThemeColors } from "../../theme";

type Props = {
  visible: boolean;
  selectedId: string;
  onClose: () => void;
  onConfirm: (iana: string) => void;
};

export function TimeZoneSearchModal({ visible, selectedId, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(selectedId);

  useEffect(() => {
    if (visible) {
      setDraft(selectedId);
      setQuery("");
    }
  }, [visible, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return IANA_TIME_ZONES as string[];
    return (IANA_TIME_ZONES as string[]).filter((z) => z.toLowerCase().includes(q));
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surfaceElevated,
              ...(Platform.OS === "android" ? { elevation: 8 } : null),
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={[typography.titleSm, { color: c.text, flex: 1 }]}>
              {t("common.timezonePickerTitle")}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={c.textMuted} />
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search (e.g. Tokyo, New_York)"
            placeholderTextColor={c.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            style={[
              styles.search,
              {
                borderColor: c.border,
                backgroundColor: c.surface,
                color: c.text,
              },
            ]}
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            initialNumToRender={24}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => {
              const on = item === draft;
              return (
                <Pressable
                  onPress={() => setDraft(item)}
                  style={[
                    styles.row,
                    on && { backgroundColor: c.brandAccentSubtle },
                  ]}
                >
                  <Text
                    style={[
                      typography.bodySm,
                      { color: on ? c.brandNavy : c.text, fontWeight: on ? "700" : "400" },
                    ]}
                    numberOfLines={1}
                  >
                    {item}
                  </Text>
                  {on ? <Ionicons name="checkmark-circle" size={20} color={c.brandAccent} /> : null}
                </Pressable>
              );
            }}
          />

          <View style={styles.btnRow}>
            <Pressable
              onPress={onClose}
              style={[styles.btnGhost, { backgroundColor: c.surfaceMuted }]}
            >
              <Text style={[typography.bodyMd, { fontWeight: "700", color: c.textSecondary }]}>
                {t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onConfirm(draft);
                onClose();
              }}
              style={[styles.btnPrimary, { backgroundColor: c.brandNavy }]}
            >
              <Text style={[typography.bodyMd, { fontWeight: "700", color: c.brandTextOn }]}>
                {t("common.done")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    padding: space.md,
  },
  card: {
    borderRadius: radii.lg,
    maxHeight: "88%",
    padding: space.md,
    gap: space.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  search: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    ...typography.bodySm,
  },
  list: { maxHeight: 420 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  btnGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.sm,
    alignItems: "center",
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.sm,
    alignItems: "center",
  },
});
