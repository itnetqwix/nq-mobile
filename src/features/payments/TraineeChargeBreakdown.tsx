import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radii, space, useStaticStyles } from "../../theme";
import { useActiveCurrency, useCurrencyFormatter } from "../../lib/intl";

export type TraineeChargeData = {
  sessionSubtotalMinor?: number;
  surgeMinor?: number;
  traineePlatformFeeMinor?: number;
  processingFeeMinor?: number;
  taxMinor?: number;
  chargeTotalMinor?: number;
};

type Props = {
  data?: TraineeChargeData | null;
  currency?: string;
  compact?: boolean;
};

function centsToDollars(cents: unknown): number | null {
  const n = Number(cents);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

export function TraineeChargeBreakdown({ data, currency = "USD", compact }: Props) {
  const styles = useStyles();
  const fmt = useCurrencyFormatter();
  const activeCurrency = useActiveCurrency(currency);

  if (!data) return null;

  const session = centsToDollars(data.sessionSubtotalMinor);
  const surge = centsToDollars(data.surgeMinor);
  const platformFee = centsToDollars(data.traineePlatformFeeMinor);
  const processing = centsToDollars(data.processingFeeMinor);
  const tax = centsToDollars(data.taxMinor);
  const total = centsToDollars(data.chargeTotalMinor);

  const hasFees =
    (surge != null && surge > 0) ||
    (platformFee != null && platformFee > 0) ||
    (processing != null && processing > 0) ||
    (tax != null && tax > 0);

  if (session == null && total == null) return null;
  if (!hasFees && session != null && total != null && Math.abs(session - total) < 0.009) {
    return null;
  }

  return (
    <View style={[styles.box, compact && styles.compact]}>
      <Text style={styles.title}>Charge breakdown</Text>
      {session != null ? (
        <Line label="Session price" value={fmt(session, { currency: activeCurrency })} />
      ) : null}
      {surge != null && surge > 0 ? (
        <Line label="Peak pricing" value={fmt(surge, { currency: activeCurrency })} />
      ) : null}
      {platformFee != null && platformFee > 0 ? (
        <Line label="Platform fee" value={fmt(platformFee, { currency: activeCurrency })} />
      ) : null}
      {processing != null && processing > 0 ? (
        <Line label="Processing fee" value={fmt(processing, { currency: activeCurrency })} />
      ) : null}
      {tax != null && tax > 0 ? (
        <Line label="Tax" value={fmt(tax, { currency: activeCurrency })} />
      ) : null}
      {total != null ? (
        <Line
          label="Total paid"
          value={fmt(total, { currency: activeCurrency })}
          bold
        />
      ) : null}
    </View>
  );
}

function Line({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, bold && styles.lineLabelBold]}>{label}</Text>
      <Text style={[styles.lineValue, bold && styles.lineValueBold]}>{value}</Text>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      box: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: palette.border,
        gap: space.xs,
        marginTop: space.sm,
      },
      compact: { padding: space.sm },
      title: {
        fontSize: 15,
        fontWeight: "700",
        color: palette.text,
        marginBottom: space.xs,
      },
      line: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 2,
      },
      lineLabel: { fontSize: 14, color: palette.textMuted },
      lineLabelBold: { color: palette.text, fontWeight: "600" },
      lineValue: { fontSize: 14, color: palette.text, fontWeight: "500" },
      lineValueBold: { fontWeight: "700" },
    })
  );
}
