/**
 * `notifyError` — standard error alert with a built-in "Report a problem"
 * CTA that deep-links into the support form with diagnostic context.
 *
 * Use this instead of bare `Alert.alert` for non-fatal failures the user
 * might want to escalate. The CTA is conditionally included for genuine
 * exceptions; pure validation messages should still use `Alert.alert`.
 *
 *   await notifyError({
 *     title: "Booking failed",
 *     error: e,
 *     action: "Confirm booking",
 *   });
 *
 * The function returns the user's tap choice so the caller can react if
 * they want (e.g. retry on "Try again").
 */

import { Alert, type AlertButton } from "react-native";
import i18n from "../../i18n";
import { getApiErrorMessage } from "../http/getApiErrorMessage";
import { haptics } from "../haptics";
import { openReportProblem, type ReportProblemContext } from "./reportProblem";

export type NotifyErrorChoice = "dismiss" | "retry" | "report";

export type NotifyErrorOptions = {
  title?: string;
  /** Optional explicit body — by default we derive from `getApiErrorMessage`. */
  message?: string;
  /** Show the "Try again" button. Returns "retry" when tapped. */
  onRetry?: () => void;
  /** Suppress the report CTA (e.g. validation alerts). */
  hideReport?: boolean;
} & ReportProblemContext;

export function notifyError(options: NotifyErrorOptions): Promise<NotifyErrorChoice> {
  const {
    title = i18n.t("common.somethingWentWrong", { defaultValue: "Something went wrong" }),
    message,
    onRetry,
    hideReport,
    error,
    action,
    note,
    bookingId,
    screen,
  } = options;

  const body = message ?? getApiErrorMessage(error, title);

  /** Fire an error haptic so screen-eyes-elsewhere users feel the failure. */
  haptics.error();

  return new Promise((resolve) => {
    const buttons: AlertButton[] = [];

    if (onRetry) {
      buttons.push({
        text: i18n.t("common.tryAgain", { defaultValue: "Try again" }),
        onPress: () => {
          resolve("retry");
          onRetry();
        },
      });
    }

    if (!hideReport) {
      buttons.push({
        text: i18n.t("support.reportProblem", { defaultValue: "Report a problem" }),
        onPress: () => {
          resolve("report");
          openReportProblem({ error, action, note, bookingId, screen });
        },
      });
    }

    buttons.push({
      text: i18n.t("common.dismiss", { defaultValue: "Dismiss" }),
      style: "cancel",
      onPress: () => resolve("dismiss"),
    });

    Alert.alert(title, body, buttons, {
      onDismiss: () => resolve("dismiss"),
      cancelable: true,
    });
  });
}
