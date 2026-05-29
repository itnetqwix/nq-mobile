import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AccountType } from "../../../constants/accountType";
import { queryKeys } from "../../../lib/queryKeys";
import type { HomeStackParamList } from "../../../navigation/types";
import { useAuth } from "../context/AuthContext";
import { openChatWithUser } from "../../chats/lib/openChatWithUser";
import { replayGuestData } from "../lib/guestActivity";
import { setDeferredBookResume } from "../lib/deferredBookResume";
import { consumePendingAuthIntent } from "../lib/pendingAuthIntent";
import { getTrainerId, getTrainerName } from "../../bookexpert/lib/trainerUtils";

type HomeNav = NativeStackNavigationProp<HomeStackParamList>;

type Props = {
  onResumeBook?: (trainer: Record<string, unknown>, mode: "instant" | "schedule") => void;
};

/**
 * Bridges the gap between "guest tapped a gated action" and "user is now
 * signed in":
 *
 *  - Resumes whichever action triggered the redirect (book Coach X, chat
 *    with Coach Y, etc.).
 *  - Replays everything the guest hearted / viewed / searched up to the
 *    server so the new account's home doesn't start cold.
 *
 * Runs exactly once per app session — guarded by a ref so navigation
 * transitions don't double-fire it.
 */
export function PendingAuthResumeBridge({ onResumeBook }: Props) {
  const { status, accountType } = useAuth();
  const navigation = useNavigation<HomeNav>();
  const queryClient = useQueryClient();
  const handled = useRef(false);

  useEffect(() => {
    if (status !== "signedIn" || handled.current) return;
    handled.current = true;

    const pending = consumePendingAuthIntent();

    /**
     * Fire-and-forget: the user already sees the signed-in dashboard. As
     * the replays finish, we invalidate the favorites cache so any hearts
     * they tapped while signed out animate into the real list.
     */
    void replayGuestData()
      .then(({ favoritesReplayed }) => {
        if (favoritesReplayed > 0) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.trainee.favorites });
        }
      })
      .catch(() => {});

    if (!pending) return;

    if (pending.intent === "book" && pending.trainer && onResumeBook) {
      setDeferredBookResume({
        trainer: pending.trainer,
        mode: pending.bookMode ?? "instant",
      });
      return;
    }

    if (pending.intent === "book" && accountType === AccountType.TRAINEE) {
      navigation.navigate("DashboardFeature", { featureId: "book-lesson" });
      return;
    }

    if (pending.intent === "chat" && pending.trainer) {
      const trainerId = getTrainerId(pending.trainer);
      if (trainerId) {
        void openChatWithUser(
          navigation,
          {
            _id: trainerId,
            fullname: getTrainerName(pending.trainer) || "Coach",
            profile_picture: pending.trainer.profile_picture as string | undefined,
          },
          (key, opts) => String(opts?.defaultValue ?? key)
        );
        return;
      }
    }

    if (pending.intent === "chat") {
      try {
        (navigation as any).getParent()?.navigate("Chats");
      } catch {
        navigation.navigate("DashboardFeature", { featureId: "my-community" });
      }
      return;
    }

    if (pending.intent === "schedule") {
      navigation.navigate("DashboardFeature", { featureId: "book-lesson" });
    }
  }, [status, accountType, navigation, onResumeBook, queryClient]);

  return null;
}
