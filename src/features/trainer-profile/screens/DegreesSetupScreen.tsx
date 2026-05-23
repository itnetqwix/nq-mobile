import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ScreenContainer, Stack } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
import { CredentialRowEditor, CredentialTextField } from "../components/CredentialRowEditor";
import { newCredentialId, type TrainerDegree } from "../types/trainerCredentials";

type Props = {
  initial: TrainerDegree[];
  onFinish: (items: TrainerDegree[]) => void;
  onSkip: () => void;
};

export function DegreesSetupScreen({ initial, onFinish, onSkip }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const [items, setItems] = useState<TrainerDegree[]>(initial.length ? initial : []);

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { id: newCredentialId(), degree: "", institution: "" },
    ]);
  };

  const update = (id: string, patch: Partial<TrainerDegree>) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  const handleFinish = () => {
    const valid = items.filter((r) => r.degree.trim() && r.institution.trim());
    onFinish(valid);
  };

  return (
    <ScreenContainer scroll applyTopInset padding="lg" background={c.background}>
      <Text style={[typography.titleMd, { color: c.text }]}>
        {t("trainerProfile.degreesTitle")}
      </Text>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        {t("trainerProfile.degreesHint")}
      </Text>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Stack gap="sm">
          {items.map((row, index) => (
            <CredentialRowEditor
              key={row.id}
              title={t("trainerProfile.degreeN", { n: index + 1 })}
              onRemove={() => remove(row.id)}
            >
              <CredentialTextField
                label={t("trainerProfile.degreeName")}
                value={row.degree}
                onChangeText={(v) => update(row.id, { degree: v })}
                required
              />
              <CredentialTextField
                label={t("trainerProfile.fieldOfStudy")}
                value={row.field_of_study ?? ""}
                onChangeText={(v) => update(row.id, { field_of_study: v })}
              />
              <CredentialTextField
                label={t("trainerProfile.institution")}
                value={row.institution}
                onChangeText={(v) => update(row.id, { institution: v })}
                required
              />
              <CredentialTextField
                label={t("trainerProfile.degreeLocation")}
                value={row.location ?? ""}
                onChangeText={(v) => update(row.id, { location: v })}
              />
              <CredentialTextField
                label={t("trainerProfile.graduationYear")}
                value={row.graduation_year ?? ""}
                onChangeText={(v) => update(row.id, { graduation_year: v })}
                placeholder="YYYY"
              />
            </CredentialRowEditor>
          ))}
          <Button label={t("trainerProfile.addDegree")} variant="secondary" onPress={addRow} />
        </Stack>
      </ScrollView>
      <View style={styles.footer}>
        <Button label={t("trainerProfile.skipForNow")} variant="ghost" onPress={onSkip} />
        <Button label={t("common.done")} size="lg" onPress={handleFinish} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.bodySm, marginVertical: space.md, lineHeight: 20 },
  footer: { gap: space.sm, marginTop: space.md },
});
