/**
 * TrainerExtensionRequestModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown on the trainer side whenever the trainee asks to extend the lesson.
 * Mounts once and self-shows when `flow.state.phase === "awaiting_trainer"`
 * (i.e. the server has pushed a pending request snapshot).
 *
 * UX
 *   - Top: trainee name + requested minutes + total amount.
 *   - Middle: countdown to auto-decline so the trainer feels the urgency.
 *   - Bottom: Accept / Reject buttons; tapping Accept passes control to the
 *     trainee's payment modal (the lesson timer stays paused on the server).
 *
 * Tapping outside / hardware back is treated as "ignore" — the request stays
 * pending so the trainer can come back to it; the auto-reject timer will
 * eventually resume the lesson timer if they never decide.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import type { UseSessionExtensionFlow } from "../useSessionExtensionFlow";

type Props = {
  flow: UseSessionExtensionFlow;
  /** Optional display name for the trainee (e.g. peer.fullname). */
  traineeName?: string | null;
};

function formatCountdown(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function useCountdownToIso(iso: string | null): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return 0;
  const target = new Date(iso).getTime();
  return Math.max(0, Math.floor((target - now) / 1000));
}

export function TrainerExtensionRequestModal({ flow, traineeName }: Props) {
  const insets = useSafeAreaInsets();
  const { state, acceptRequest, rejectRequest } = flow;
  const { phase, request } = state;

  const isVisible = phase === "awaiting_trainer" && !!request;
  const expiryCountdown = useCountdownToIso(request?.expiresAt ?? null);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);

  useEffect(() => {
    if (!isVisible) setBusy(null);
  }, [isVisible]);

  const handleAccept = async () => {
    if (!request) return;
    setBusy("accept");
    await acceptRequest(request.requestId);
    // Hook flips to "awaiting_payment" via socket; modal hides on next render.
  };

  const handleReject = async () => {
    if (!request) return;
    setBusy("reject");
    await rejectRequest(request.requestId);
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide">
      <View style={[styles.backdrop, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Ionicons name="alarm-outline" size={22} color={colors.brandNavy} />
            <Text style={styles.title}>Extension request</Text>
          </View>
          <Text style={styles.sub}>
            {traineeName ? `${traineeName} wants ` : "Trainee wants "}
            {request?.minutes ?? 0} more minutes on this lesson.
          </Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>Extra time</Text>
              <Text style={styles.summaryValue}>+{request?.minutes ?? 0} min</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text style={styles.summaryLabel}>You earn</Text>
              <Text style={styles.summaryValue}>
                ${Number(request?.amount ?? 0).toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.countdownBlock}>
            <ActivityIndicator color={colors.brandNavy} />
            <Text style={styles.countdownText}>
              Auto-decline in {formatCountdown(expiryCountdown)}
            </Text>
          </View>

          <Button
            label={busy === "accept" ? "Approving…" : "Accept"}
            onPress={handleAccept}
            disabled={busy != null}
            fullWidth
          />
          <Button
            label={busy === "reject" ? "Declining…" : "Reject"}
            onPress={handleReject}
            disabled={busy != null}
            variant="ghost"
            fullWidth
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: space.lg,
    gap: space.sm,
  },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { ...typography.titleSm, color: colors.text, flex: 1 },
  sub: { ...typography.bodySm, color: colors.textMuted },
  summaryRow: {
    flexDirection: "row",
    gap: space.sm,
    marginVertical: space.md,
  },
  summaryCell: {
    flex: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    alignItems: "center",
    gap: 4,
  },
  summaryLabel: { ...typography.label, color: colors.textMuted },
  summaryValue: { ...typography.titleSm, color: colors.text },
  countdownBlock: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: space.sm,
  },
  countdownText: { ...typography.bodySm, color: colors.textMuted },
});
