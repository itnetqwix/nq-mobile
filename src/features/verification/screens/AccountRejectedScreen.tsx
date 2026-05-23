import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccountType } from "../../../constants/accountType";
import { useAuth } from "../../auth/context/AuthContext";
import { reapplyAccount } from "../../clips/api/clipsApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { colors, radii, space, typography } from "../../../theme";
import { useAppTranslation } from "../../../i18n/useAppTranslation";

type Props = {
  onReapplied: () => void;
};

export function AccountRejectedScreen({ onReapplied }: Props) {
  const { t } = useAppTranslation();
  const { user, accountType, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = useMemo(() => {
    if (accountType === AccountType.TRAINER) {
      const tv = (user?.trainer_verification || {}) as Record<string, unknown>;
      return String(tv.rejection_reason || "").trim();
    }
    return String((user as any)?.account_rejection_reason || "").trim();
  }, [user, accountType]);

  const reapply = async () => {
    setBusy(true);
    setError(null);
    try {
      await reapplyAccount();
      await refreshUser();
      onReapplied();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{t("verification.accountRejectedTitle")}</Text>
        <Text style={styles.lead}>{t("verification.accountRejectedLead")}</Text>
        {reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>{t("verification.rejectionReasonLabel")}</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        ) : (
          <Text style={styles.muted}>{t("verification.noRejectionReason")}</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={() => void reapply()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.brandTextOn} />
          ) : (
            <Text style={styles.btnText}>{t("verification.reapplyCta")}</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: space.lg, paddingTop: space.xl },
  title: { ...typography.titleLg, color: colors.text, marginBottom: space.sm },
  lead: { ...typography.bodyMd, color: colors.textMuted, marginBottom: space.lg, lineHeight: 22 },
  reasonBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    padding: space.md,
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 6 },
  reasonText: { ...typography.bodyMd, color: colors.text, lineHeight: 22 },
  muted: { color: colors.textMuted, marginBottom: space.lg },
  error: { color: "#b91c1c", marginBottom: space.md },
  btn: {
    backgroundColor: colors.brandNavy,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.brandTextOn, fontWeight: "700", fontSize: 16 },
});
