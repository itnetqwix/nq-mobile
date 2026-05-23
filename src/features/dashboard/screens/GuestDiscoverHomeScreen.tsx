import React, { useLayoutEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountType } from "../../../constants/accountType";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import type { HomeStackParamList } from "../../../navigation/types";
import { space, typography, useThemeColors } from "../../../theme";
import { useRequireAuth } from "../../auth/hooks/useRequireAuth";
import { TrainerProfileModal } from "../../bookexpert/components/TrainerProfileModal";
import { TraineeDiscoverDashboard } from "../components/home/TraineeDiscoverDashboard";

type Nav = NativeStackNavigationProp<HomeStackParamList, "DashboardHome">;

export function GuestDiscoverHomeScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { requireAuth, openAuth } = useRequireAuth();
  const [profileTrainer, setProfileTrainer] = useState<Record<string, unknown> | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => openAuth("Login")}
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.headerBtnText, { color: c.brandAccent }]}>
            {t("auth.signIn")}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, openAuth, t, c.brandAccent]);

  return (
    <>
      <TrainerProfileModal
        visible={!!profileTrainer}
        trainer={profileTrainer}
        onDismiss={() => setProfileTrainer(null)}
        onInstant={() => requireAuth(undefined, "guest.signInToBook")}
        onSchedule={() => requireAuth(undefined, "guest.signInToBook")}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ paddingBottom: space.xl * 2 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.banner, { backgroundColor: c.brandAccentSubtle, borderColor: c.brandAccent }]}>
          <Text style={[typography.titleSm, { color: c.brandNavy }]}>
            {t("guest.exploreBannerTitle")}
          </Text>
          <Text style={[styles.bannerBody, { color: c.textSecondary }]}>
            {t("guest.exploreBannerBody")}
          </Text>
          <View style={styles.bannerActions}>
            <Pressable
              onPress={() => openAuth("SignUp")}
              style={[styles.bannerPrimary, { backgroundColor: c.brandAccent }]}
            >
              <Text style={styles.bannerPrimaryText}>{t("auth.createAccount")}</Text>
            </Pressable>
            <Pressable onPress={() => openAuth("Login")} style={styles.bannerLink}>
              <Text style={[styles.bannerLinkText, { color: c.brandAccent }]}>
                {t("auth.signIn")}
              </Text>
            </Pressable>
          </View>
        </View>

        <TraineeDiscoverDashboard
          isGuest
          name={t("guest.explorerName")}
          accountType={AccountType.TRAINEE}
          user={null}
          onSettings={() => openAuth("Login")}
          onViewTrainer={setProfileTrainer}
          onInstantBook={() => requireAuth(undefined, "guest.signInToBook")}
          onScheduleBook={() => requireAuth(undefined, "guest.signInToBook")}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: { paddingHorizontal: space.sm, paddingVertical: space.xs },
  headerBtnText: { fontWeight: "700", fontSize: 16 },
  banner: {
    marginHorizontal: space.md,
    marginTop: space.md,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerBody: {
    ...typography.bodySm,
    marginTop: space.xs,
    lineHeight: 20,
  },
  bannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.md,
  },
  bannerPrimary: {
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: 999,
  },
  bannerPrimaryText: { color: "#fff", fontWeight: "700" },
  bannerLink: { paddingVertical: 8 },
  bannerLinkText: { fontWeight: "600" },
});
