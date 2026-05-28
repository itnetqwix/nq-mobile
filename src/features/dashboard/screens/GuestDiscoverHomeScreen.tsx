import React, { useLayoutEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { AccountType } from "../../../constants/accountType";
import { useHorizontalGutter } from "../../../lib/layout/useHorizontalGutter";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import type { HomeStackParamList } from "../../../navigation/types";
import { space, useThemeColors } from "../../../theme";
import { useRequireAuth } from "../../auth/hooks/useRequireAuth";
import { recordTrainerView } from "../../auth/lib/guestActivity";
import { TrainerProfileModal } from "../../bookexpert/components/TrainerProfileModal";
import { FreeIntroLessonHero } from "../components/guest/FreeIntroLessonHero";
import { GuestSavedCoachesStrip } from "../components/guest/GuestSavedCoachesStrip";
import { TraineeDiscoverDashboard } from "../components/home/TraineeDiscoverDashboard";
import { useGuestFavoriteTrainers } from "../hooks/useGuestFavoriteTrainers";
import { GuestBrowsingNudge } from "../components/guest/GuestBrowsingNudge";
import { useContentDeepLink } from "../../content/hooks/useContentDeepLink";

type Nav = NativeStackNavigationProp<HomeStackParamList, "DashboardHome">;

export function GuestDiscoverHomeScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const gutter = useHorizontalGutter("md");
  const navigation = useNavigation<Nav>();
  const { requireAuth, openAuth } = useRequireAuth();
  const handleContentDeepLink = useContentDeepLink({
    openShell: () => openAuth("Login"),
    onRequireAuth: () => openAuth("Login"),
  });
  const [profileTrainer, setProfileTrainer] = useState<Record<string, unknown> | null>(null);
  const { favorites: savedTrainers } = useGuestFavoriteTrainers(true);

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
          scrollable
          leadingContent={
            <View style={styles.heroWrap}>
              <GuestBrowsingNudge onSignUp={() => openAuth("SignUp")} />
              <FreeIntroLessonHero
                onPress={() =>
                  requireAuth(undefined, {
                    intent: "book",
                    messageKey: "guest.signInToBook",
                    screen: "SignUp",
                  })
                }
              />
              <GuestSavedCoachesStrip
                favorites={savedTrainers}
                onPress={(trainer) => {
                  void recordTrainerView(trainer);
                  setProfileTrainer(trainer);
                }}
              />
            </View>
          }
          contentContainerStyle={[
            gutter,
            {
              paddingTop: space.sm,
              paddingBottom: space.xl * 2 + insets.bottom,
            },
          ]}
          name={t("guest.explorerName")}
          accountType={AccountType.TRAINEE}
          user={null}
          onSettings={() => openAuth("Login")}
          onViewTrainer={(trainer) => {
            void recordTrainerView(trainer);
            setProfileTrainer(trainer);
          }}
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
          onToggleFavoriteGuest={undefined}
          onContentDeepLink={handleContentDeepLink}
        />
    </>
  );
}

const styles = StyleSheet.create({
  headerBtn: { paddingHorizontal: space.sm, paddingVertical: space.xs },
  headerBtnText: { fontWeight: "700", fontSize: 16 },
  heroWrap: { gap: 0 },
});
