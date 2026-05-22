import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, space, typography, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

type Props = {
  category: string;
  alternatives: string[];
  onPick: (sport: string) => void;
};

export function CategoryEmptySuggestions({ category, alternatives, onPick }: Props) {
  const { t } = useAppTranslation();
  const styles = useStyles();
  if (!alternatives.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("traineeDiscover.emptyCategory", { category })}</Text>
      <View style={styles.row}>
        {alternatives.map((sport) => (
          <Pressable
            key={sport}
            style={({ pressed }) => [styles.chip, pressed && { opacity: 0.85 }]}
            onPress={() => onPick(sport)}
          >
            <Text style={styles.chipText}>{t("traineeDiscover.trySport", { sport })}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { alignItems: "center", gap: space.sm, paddingVertical: space.md },
      title: { ...typography.bodySm, color: palette.text, textAlign: "center" },
      row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, justifyContent: "center" },
      chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: palette.brandSubtle,
        borderWidth: 1,
        borderColor: palette.brandNavy,
      },
      chipText: { ...typography.caption, color: palette.brandNavy, fontWeight: "700" },
    })
  );
}
