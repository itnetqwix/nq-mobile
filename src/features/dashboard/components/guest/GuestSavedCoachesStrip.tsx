import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors } from "../../../../theme";
import { getTrainerName } from "../../../bookexpert/lib/trainerUtils";

type Props = {
  favorites: Record<string, unknown>[];
  onPress: (trainer: Record<string, unknown>) => void;
};

/**
 * Horizontal "saved coaches" rail that shows the trainers a guest has
 * hearted. We render even when empty so the heart button has somewhere
 * to land — empty state nudges them toward favoriting.
 */
export function GuestSavedCoachesStrip({ favorites, onPress }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Ionicons name="heart" size={16} color="#E53935" />
        <Text style={[typography.titleSm, { color: c.text }]}>
          {t("guest.saved.title")}
        </Text>
        {favorites.length > 0 ? (
          <View style={[styles.countPill, { backgroundColor: c.brandAccentSubtle }]}>
            <Text style={[styles.countText, { color: c.brandAccent }]}>
              {favorites.length}
            </Text>
          </View>
        ) : null}
      </View>

      {favorites.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          {t("guest.saved.empty")}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {favorites.map((trainer) => {
            const id = String((trainer as { _id?: string })._id ?? "");
            const name = getTrainerName(trainer);
            const pic =
              (trainer.profile_picture as string | undefined) ||
              (trainer.avatar as string | undefined);
            return (
              <Pressable
                key={id || name}
                onPress={() => onPress(trainer)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: c.surfaceElevated,
                    borderColor: c.borderSubtle,
                  },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: c.brandAccentSubtle, borderColor: c.brandAccent },
                  ]}
                >
                  {pic ? (
                    <Image source={{ uri: pic }} style={styles.avatarImg} contentFit="cover" />
                  ) : (
                    <Text style={[styles.avatarLetter, { color: c.brandAccent }]}>
                      {name.slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text
                  style={[styles.name, { color: c.text }]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: space.md },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: space.sm,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 4,
  },
  countText: { fontSize: 11, fontWeight: "800" },
  empty: { fontSize: 13, lineHeight: 18 },
  row: { gap: space.sm, paddingRight: space.md },
  card: {
    width: 96,
    alignItems: "center",
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarLetter: { fontWeight: "800", fontSize: 20 },
  name: { fontSize: 12, fontWeight: "700", textAlign: "center" },
});
