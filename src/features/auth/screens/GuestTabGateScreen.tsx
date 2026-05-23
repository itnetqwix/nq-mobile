import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
import { useRequireAuth } from "../hooks/useRequireAuth";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
};

/** Shown on Schedule / Chats tabs when browsing as a guest. */
export function GuestTabGateScreen({ icon, titleKey, bodyKey }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const { openAuth } = useRequireAuth();

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: c.brandAccentSubtle }]}>
        <Ionicons name={icon} size={40} color={c.brandAccent} />
      </View>
      <Text style={[typography.titleMd, styles.title, { color: c.text }]}>
        {t(titleKey)}
      </Text>
      <Text style={[styles.body, { color: c.textMuted }]}>{t(bodyKey)}</Text>
      <Button label={t("auth.signIn")} size="lg" onPress={() => openAuth("Login")} />
      <Button
        label={t("auth.createAccount")}
        variant="secondary"
        size="lg"
        onPress={() => openAuth("SignUp")}
        style={styles.secondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  title: { textAlign: "center" },
  body: {
    ...typography.bodyMd,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: space.md,
  },
  secondary: { marginTop: space.xs },
});
