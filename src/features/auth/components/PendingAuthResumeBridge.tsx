import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useRef } from "react";
import { AccountType } from "../../../constants/accountType";
import type { HomeStackParamList } from "../../../navigation/types";
import { useAuth } from "../context/AuthContext";
import { consumePendingAuthIntent } from "../lib/pendingAuthIntent";

type HomeNav = NativeStackNavigationProp<HomeStackParamList>;

type Props = {
  onResumeBook?: (trainer: Record<string, unknown>, mode: "instant" | "schedule") => void;
};

/**
 * After sign-in, resumes a guest action (e.g. open booking for the trainer they tapped).
 */
export function PendingAuthResumeBridge({ onResumeBook }: Props) {
  const { status, accountType } = useAuth();
  const navigation = useNavigation<HomeNav>();
  const handled = useRef(false);

  useEffect(() => {
    if (status !== "signedIn" || handled.current) return;
    const pending = consumePendingAuthIntent();
    if (!pending) return;
    handled.current = true;

    if (pending.intent === "book" && pending.trainer && onResumeBook) {
      onResumeBook(pending.trainer, pending.bookMode ?? "instant");
      return;
    }

    if (pending.intent === "book" && accountType === AccountType.TRAINEE) {
      navigation.navigate("DashboardFeature", {
        featureId: "book-lesson",
      });
    }
  }, [status, accountType, navigation, onResumeBook]);

  return null;
}
