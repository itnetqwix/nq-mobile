import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ScreenContainer, Stack } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
import { CredentialRowEditor, CredentialTextField } from "../components/CredentialRowEditor";
import { newCredentialId, type TrainerCertificate } from "../types/trainerCredentials";

type Props = {
  initial: TrainerCertificate[];
  onNext: (items: TrainerCertificate[]) => void;
  onSkip: () => void;
};

export function CertificatesSetupScreen({ initial, onNext, onSkip }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const [items, setItems] = useState<TrainerCertificate[]>(
    initial.length ? initial : []
  );

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { id: newCredentialId(), title: "", issuer: "" },
    ]);
  };

  const update = (id: string, patch: Partial<TrainerCertificate>) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  const handleNext = () => {
    const valid = items.filter((r) => r.title.trim() && r.issuer.trim());
    onNext(valid);
  };

  return (
    <ScreenContainer scroll applyTopInset padding="lg" background={c.background}>
      <Text style={[typography.titleMd, { color: c.text }]}>
        {t("trainerProfile.certificatesTitle")}
      </Text>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        {t("trainerProfile.certificatesHint")}
      </Text>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <Stack gap="sm">
          {items.map((row, index) => (
            <CredentialRowEditor
              key={row.id}
              title={t("trainerProfile.certificateN", { n: index + 1 })}
              onRemove={() => remove(row.id)}
            >
              <CredentialTextField
                label={t("trainerProfile.certTitle")}
                value={row.title}
                onChangeText={(v) => update(row.id, { title: v })}
                required
              />
              <CredentialTextField
                label={t("trainerProfile.certIssuer")}
                value={row.issuer}
                onChangeText={(v) => update(row.id, { issuer: v })}
                required
              />
              <CredentialTextField
                label={t("trainerProfile.certIssued")}
                value={row.issued_at ?? ""}
                onChangeText={(v) => update(row.id, { issued_at: v })}
                placeholder="YYYY-MM"
              />
              <CredentialTextField
                label={t("trainerProfile.certExpires")}
                value={row.expires_at ?? ""}
                onChangeText={(v) => update(row.id, { expires_at: v })}
                placeholder="YYYY-MM"
              />
            </CredentialRowEditor>
          ))}
          <Button label={t("trainerProfile.addCertificate")} variant="secondary" onPress={addRow} />
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
  footer: { gap: space.sm, marginTop: space.md },
});
