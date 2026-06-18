import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { colors, space } from "../../../theme";

type Props = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  onOpenLegal?: (slug: "terms" | "privacy") => void;
};

export function LegalTermsAcceptance({ value, onValueChange, onOpenLegal }: Props) {
  const { t } = useAppTranslation();

  const openTerms = () => {
    if (onOpenLegal) onOpenLegal("terms");
  };
  const openPrivacy = () => {
    if (onOpenLegal) onOpenLegal("privacy");
  };

  return (
    <View style={styles.row}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={t("auth.legalTermsA11y")}
      />
      <Text style={styles.text}>
        {t("auth.legalTermsPrefix")}{" "}
        <Text style={styles.link} onPress={openTerms}>
          {t("auth.termsConditions")}
        </Text>{" "}
        {t("auth.legalTermsAnd")}{" "}
        <Text style={styles.link} onPress={openPrivacy}>
          {t("auth.privacyPolicy")}
        </Text>
        <Text style={styles.required}> *</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    marginVertical: space.sm,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  link: {
    color: colors.brandAccent,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  required: {
    color: colors.danger,
    fontWeight: "700",
  },
});
