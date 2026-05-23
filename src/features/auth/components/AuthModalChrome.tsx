import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
import type { AuthScreenParams } from "../types/authIntent";

type Props = {
  children: React.ReactNode;
};

export function AuthModalChrome({ children }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params ?? {}) as AuthScreenParams;

  const dismissToBrowse = () => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const contextMessage = params.messageKey
    ? t(params.messageKey)
    : params.intent === "book"
      ? t("guest.signInToBook")
      : params.intent === "favorite"
        ? t("guest.signInToContinue")
        : params.intent === "chat"
          ? t("guest.chatsBody")
          : undefined;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, space.sm) }]}>
        <Pressable
          onPress={dismissToBrowse}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={t("auth.continueBrowsing")}
        >
          <Ionicons name="close" size={22} color={c.text} />
          <Text style={[styles.closeText, { color: c.text }]}>{t("auth.continueBrowsing")}</Text>
        </Pressable>
      </View>
      {contextMessage ? (
        <View style={[styles.contextBanner, { backgroundColor: c.brandAccentSubtle }]}>
          <Text style={[styles.contextText, { color: c.brandNavy }]}>{contextMessage}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    paddingHorizontal: space.md,
    paddingBottom: space.xs,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: space.xs,
  },
  closeText: { ...typography.bodyMd, fontWeight: "600" },
  contextBanner: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: 12,
  },
  contextText: { ...typography.bodySm, lineHeight: 20 },
});
