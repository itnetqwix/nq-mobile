import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
import type { AuthScreenParams } from "../types/authIntent";

type Props = {
  children: React.ReactNode;
};

export function AuthModalChrome({ children }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
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
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.root, { backgroundColor: c.background }]}
    >
      {/* Fixed-height top bar so the close button is never clipped by the safe area */}
      <View style={[styles.topBar, { borderBottomColor: c.border }]}>
        <Pressable
          onPress={dismissToBrowse}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={t("auth.continueBrowsing")}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <View style={[styles.closeIconWrap, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
            <Ionicons name="close" size={18} color={c.text} />
          </View>
          <Text style={[styles.closeText, { color: c.text }]}>{t("auth.continueBrowsing")}</Text>
        </Pressable>
      </View>
      {contextMessage ? (
        <View style={[styles.contextBanner, { backgroundColor: c.brandAccentSubtle }]}>
          <Text style={[styles.contextText, { color: c.brandNavy }]}>{contextMessage}</Text>
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
