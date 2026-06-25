import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radii, space, useStaticStyles } from "../../theme";
import { useActiveCurrency, useCurrencyFormatter } from "../../lib/intl";

export type TrainerEarningsData = {
  sessionSubtotalCents?: number;
  surgeCents?: number;
  commissionRate?: number | null;
  commissionCents?: number;
  trainerPlatformFeeCents?: number;
  trainerNetCents?: number;
  escrowStatus?: string | null;
  holdCount?: number;
};

export type TrainerEarningsHoldLeg = {
  kind?: string;
  chargeTotalMinor?: number;
  trainerNetMinor?: number;
  status?: string;
  funding_source?: string;
};

type Props = {
  data?: TrainerEarningsData | null;
  holds?: TrainerEarningsHoldLeg[] | null;
  currency?: string;
  compact?: boolean;
};

function centsToDollars(cents: unknown): number | null {
  const n = Number(cents);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

export function TrainerEarningsBreakdown({ data, holds, currency = "USD", compact }: Props) {
  const styles = useStyles();
  const fmt = useCurrencyFormatter();
  const activeCurrency = useActiveCurrency(currency);

  if (!data) return null;

  const session = centsToDollars(data.sessionSubtotalCents);
  const surge = centsToDollars(data.surgeCents);
  const commission = centsToDollars(data.commissionCents);
  const platformFee = centsToDollars(data.trainerPlatformFeeCents);
  const net = centsToDollars(data.trainerNetCents);
  const ratePct =
    data.commissionRate != null && Number.isFinite(Number(data.commissionRate))
      ? (Number(data.commissionRate) > 1
          ? Number(data.commissionRate)
          : Number(data.commissionRate) * 100
        ).toFixed(1)
      : null;

  if (session == null && net == null) return null;

  return (
    <View style={[styles.box, compact && styles.compact]}>
      <Text style={styles.title}>Your earnings</Text>
      {session != null ? (
        <Line label="Session gross" value={fmt(session, { currency: activeCurrency })} />
      ) : null}
      {surge != null && surge > 0 ? (
        <Line label="Peak pricing" value={fmt(surge, { currency: activeCurrency })} accent />
      ) : null}
      {commission != null && commission > 0 ? (
        <Line
          label={ratePct ? `Commission (${ratePct}%)` : "Commission"}
          value={`-${fmt(commission, { currency: activeCurrency })}`}
        />
      ) : null}
      {platformFee != null && platformFee > 0 ? (
        <Line
          label="Platform fee"
          value={`-${fmt(platformFee, { currency: activeCurrency })}`}
        />
      ) : null}
      {net != null ? (
        <Line
          label="You earn"
          value={fmt(net, { currency: activeCurrency })}
          bold
        />
      ) : null}
      {data.escrowStatus ? (
        <Text style={styles.hint}>
          Escrow: {String(data.escrowStatus)}
          {data.holdCount && data.holdCount > 1 ? ` · ${data.holdCount} payments` : ""}
        </Text>
      ) : null}
      {holds && holds.length > 1 ? (
        <View style={styles.legs}>
          {holds.map((leg, idx) => {
            const legNet = centsToDollars(leg.trainerNetMinor);
            const legLabel =
              leg.kind === "extension"
                ? `Extension ${idx + 1}`
                : leg.funding_source === "wallet"
                  ? "Wallet leg"
                  : leg.funding_source === "mixed"
                    ? "Card leg"
                    : `Payment ${idx + 1}`;
            if (legNet == null) return null;
            return (
              <Line
                key={`${leg.kind}-${idx}`}
                label={legLabel}
                value={fmt(legNet, { currency: activeCurrency })}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Line({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <Text style={styles.key}>{label}</Text>
      <Text style={[styles.value, bold && styles.bold, accent && styles.accent]}>{value}</Text>
    </View>
  );
}

function useStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      box: {
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
        padding: space.md,
        gap: 8,
      },
      compact: { padding: space.sm, gap: 6 },
      title: { fontSize: 14, fontWeight: "700", color: palette.text, marginBottom: 2 },
      line: { flexDirection: "row", gap: 12 },
      key: { flex: 1, fontSize: 13, color: palette.textMuted },
      value: { fontSize: 13, color: palette.text, fontWeight: "500" },
      bold: { fontWeight: "700", color: palette.success },
      accent: { color: palette.warning },
      hint: { fontSize: 11, color: palette.textMuted, marginTop: 4 },
      legs: {
        marginTop: space.sm,
        paddingTop: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
        gap: 6,
      },
    })
  );
}
