import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Button, ScreenContainer, Stack } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
import { CredentialRowEditor, CredentialTextField } from "../components/CredentialRowEditor";
import { newCredentialId, type TrainerWorkExperience } from "../types/trainerCredentials";

type Props = {
  initial: TrainerWorkExperience[];
  onNext: (items: TrainerWorkExperience[]) => void;
  onSkip: () => void;
};

export function WorkExperienceSetupScreen({ initial, onNext, onSkip }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const [items, setItems] = useState<TrainerWorkExperience[]>(
    initial.length ? initial : []
  );

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: newCredentialId(),
        title: "",
        location: "",
        start_date: "",
        is_current: false,
      },
    ]);
  };

  const update = (id: string, patch: Partial<TrainerWorkExperience>) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  const handleNext = () => {
    const valid = items.filter(
      (r) => r.title.trim() && r.location.trim() && r.start_date.trim()
    );
    onNext(valid);
  };

  return (
    <ScreenContainer scroll dismissKeyboardOnTap applyTopInset padding="lg" background={c.background}>
      <Text style={[typography.titleMd, { color: c.text }]}>
        {t("trainerProfile.workTitle")}
      </Text>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        {t("trainerProfile.workHint")}
      </Text>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Stack gap="sm">
          {items.map((row, index) => (
            <CredentialRowEditor
              key={row.id}
              title={t("trainerProfile.workN", { n: index + 1 })}
              onRemove={() => remove(row.id)}
            >
              <CredentialTextField
                label={t("trainerProfile.workRoleTitle")}
                value={row.title}
                onChangeText={(v) => update(row.id, { title: v })}
                required
              />
              <CredentialTextField
                label={t("trainerProfile.workCompany")}
                value={row.company ?? ""}
                onChangeText={(v) => update(row.id, { company: v })}
              />
              <CredentialTextField
                label={t("trainerProfile.workLocation")}
                value={row.location}
                onChangeText={(v) => update(row.id, { location: v })}
                required
              />
              <CredentialTextField
                label={t("trainerProfile.workStart")}
                value={row.start_date}
                onChangeText={(v) => update(row.id, { start_date: v })}
                placeholder="YYYY-MM"
                required
              />
              <View style={styles.currentRow}>
                <Text style={{ color: c.text }}>{t("trainerProfile.workCurrent")}</Text>
                <Switch
                  value={!!row.is_current}
                  onValueChange={(v) =>
                    update(row.id, { is_current: v, end_date: v ? undefined : row.end_date })
                  }
                />
              </View>
              {!row.is_current ? (
                <CredentialTextField
                  label={t("trainerProfile.workEnd")}
                  value={row.end_date ?? ""}
                  onChangeText={(v) => update(row.id, { end_date: v })}
                  placeholder="YYYY-MM"
                />
              ) : null}
              <CredentialTextField
                label={t("trainerProfile.workDescription")}
                value={row.description ?? ""}
                onChangeText={(v) => update(row.id, { description: v })}
                multiline
              />
            </CredentialRowEditor>
          ))}
          <Button label={t("trainerProfile.addWork")} variant="secondary" onPress={addRow} />
        </Stack>
      </ScrollView>
      <View style={styles.footer}>
        <Button label={t("trainerProfile.skipForNow")} variant="ghost" onPress={onSkip} />
        <Button label={t("auth.continue")} size="lg" onPress={handleNext} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.bodySm, marginVertical: space.md, lineHeight: 20 },
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: space.xs,
  },
  footer: { gap: space.sm, marginTop: space.md },
});
