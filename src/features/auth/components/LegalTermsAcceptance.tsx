import React from "react";
import { Linking, StyleSheet, Switch, Text, View } from "react-native";
import { PRIVACY_POLICY_URL, TERMS_AND_CONDITIONS_URL } from "../../../constants/legalUrls";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { colors, space } from "../../../theme";

type Props = {
  value: boolean;
  onValueChange: (next: boolean) => void;
};

export function LegalTermsAcceptance({ value, onValueChange }: Props) {
  const { t } = useAppTranslation();

  return (
    <View style={styles.row}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={t("auth.legalTermsA11y")}
      />
      <Text style={styles.text}>
        {t("auth.legalTermsPrefix")}{" "}
        <Text style={styles.link} onPress={() => Linking.openURL(TERMS_AND_CONDITIONS_URL)}>
          {t("auth.termsConditions")}
        </Text>{" "}
        {t("auth.legalTermsAnd")}{" "}
        <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
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
