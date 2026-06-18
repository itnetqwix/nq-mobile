/** Trainee-facing escrow UX milestones (display only — no policy change). */

export type EscrowMilestone =
  | "session_active"
  | "ending_soon_five"
  | "ending_soon_two"
  | "early_end"
  | "both_rated";

export function escrowMilestoneCopy(milestone: EscrowMilestone): {
  title: string;
  body: string;
} {
  switch (milestone) {
    case "session_active":
      return {
        title: "Payment held in escrow",
        body: "Your payment is securely held until the lesson completes and both parties rate.",
      };
    case "ending_soon_five":
      return {
        title: "Session ending soon",
        body: "About 5 minutes remain. Funds stay in escrow until the lesson wraps up.",
      };
    case "ending_soon_two":
      return {
        title: "Session ending soon",
        body: "About 2 minutes remain. Funds stay in escrow until the lesson wraps up.",
      };
    case "early_end":
      return {
        title: "Rate to release payment",
        body: "Your session ended. Rate your coach to help release escrow after clearance (~24 hours).",
      };
    case "both_rated":
      return {
        title: "Release pending clearance",
        body: "Thanks for rating. Payment release to your coach is eligible after ~24 hours.",
      };
    default:
      return {
        title: "Payment held in escrow",
        body: "Your payment is securely held until the lesson completes.",
      };
  }
}

export function escrowMilestoneFromTimerWarning(
  kind: string | undefined
): EscrowMilestone | null {
  if (kind === "five") return "ending_soon_five";
  if (kind === "two") return "ending_soon_two";
  return null;
}
