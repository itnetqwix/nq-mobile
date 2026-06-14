import React, { useLayoutEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { AccountType } from "../../../constants/accountType";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
import { useMarketplaceScrollPadding } from "../../home/layout/marketplaceLayout";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import type { HomeStackParamList } from "../../../navigation/types";
import { space, typography, useThemeColors, radii } from "../../../theme";
import { useRequireAuth } from "../../auth/hooks/useRequireAuth";
import { TrainerProfileModal } from "../../bookexpert/components/TrainerProfileModal";
import { TraineeDiscoverDashboard } from "../components/home/TraineeDiscoverDashboard";

type Nav = NativeStackNavigationProp<HomeStackParamList, "DashboardHome">;

export function GuestDiscoverHomeScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const scrollBottomPad = useMarketplaceScrollPadding();
  const gutter = useHorizontalGutter("md");
  const navigation = useNavigation<Nav>();
  const { requireAuth, openAuth } = useRequireAuth();
  const [profileTrainer, setProfileTrainer] = useState<Record<string, unknown> | null>(null);

  useLayoutEffect(() => {
    if (typeof navigation?.setOptions !== "function") return;
    navigation.setOptions({
      headerTitle: () => (
        <NetqwixLogo variant="wordmark" maxWidth={132} height={34} compact align="center" />
      ),
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
        onInstant={(trainer) =>
          requireAuth(undefined, {
            intent: "book",
            messageKey: "guest.signInToBook",
            trainer,
            bookMode: "instant",
            screen: "Login",
          })
        }
        onSchedule={(trainer) =>
          requireAuth(undefined, {
            intent: "book",
            messageKey: "guest.signInToBook",
            trainer,
            bookMode: "schedule",
            screen: "Login",
          })
        }
      />
      <TraineeDiscoverDashboard
          isGuest
          leadingContent={
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
          }
          contentContainerStyle={[
            gutter,
            {
              paddingTop: space.xs,
              paddingBottom: scrollBottomPad,
            },
          ]}
          name={t("guest.explorerName")}
          accountType={AccountType.TRAINEE}
          user={null}
          onSettings={() => openAuth("Login")}
          onViewTrainer={setProfileTrainer}
          onInstantBook={(trainer) =>
            requireAuth(undefined, {
              intent: "book",
              messageKey: "guest.signInToBook",
              trainer,
              bookMode: "instant",
            })
          }
          onScheduleBook={(trainer) =>
            requireAuth(undefined, {
              intent: "book",
              messageKey: "guest.signInToBook",
              trainer,
              bookMode: "schedule",
            })
          }
          onToggleFavoriteGuest={() =>
            requireAuth(undefined, {
              intent: "favorite",
              messageKey: "guest.signInToContinue",
              screen: "SignUp",
            })
          }
        />
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: { paddingHorizontal: space.sm, paddingVertical: space.xs },
  headerBtnText: { fontWeight: "700", fontSize: 16 },
  banner: {
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radii.lg,
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
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
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
