import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { radii, space, typography, useStaticStyles, useThemeColors } from "../../../theme";

type HeroProps = {
  title: string;
  subtitle?: string;
  trainerName?: string;
  badge?: string;
};

export function ScheduleStepHero({ title, subtitle, trainerName, badge }: HeroProps) {
  const styles = useHeroStyles();
  return (
    <View style={styles.root}>
      {trainerName ? <Text style={styles.trainer}>{trainerName}</Text> : null}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

type InfoChipProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  message: string;
  tone?: "info" | "success" | "warning";
};

export function ScheduleInfoChip({ icon = "information-circle-outline", message, tone = "info" }: InfoChipProps) {
  const c = useThemeColors();
  const styles = useInfoStyles();
  const tint =
    tone === "success" ? c.success : tone === "warning" ? c.warning : c.brandNavy;
  const bg =
    tone === "success"
      ? c.success + "14"
      : tone === "warning"
        ? c.warning + "14"
        : c.brandSubtle;

  return (
    <View style={[styles.root, { backgroundColor: bg, borderColor: tint + "33" }]}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={[styles.text, { color: c.text }]}>{message}</Text>
    </View>
  );
}

type SectionProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function ScheduleSection({ title, subtitle, children, style }: SectionProps) {
  const styles = useSectionStyles();
  return (
    <View style={[styles.root, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

type FlowStep = { label: string; done: boolean; active: boolean };

export function ScheduleFlowSteps({ steps }: { steps: FlowStep[] }) {
  const c = useThemeColors();
  const styles = useFlowStyles();
  return (
    <View style={styles.root}>
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <View style={styles.step}>
            <View
              style={[
                styles.dot,
                step.done && styles.dotDone,
                step.active && !step.done && styles.dotActive,
              ]}
            >
              {step.done ? (
                <Ionicons name="checkmark" size={12} color={c.brandTextOn} />
              ) : (
                <Text style={[styles.dotNum, step.active && styles.dotNumActive]}>{i + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.label,
                step.active && styles.labelActive,
                step.done && styles.labelDone,
              ]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </View>
          {i < steps.length - 1 ? <View style={[styles.connector, step.done && styles.connectorDone]} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

type SessionSummaryProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  value: string;
  hint?: string;
};

export function ScheduleSessionSummary({
  icon = "calendar-outline",
  label,
  value,
  hint,
}: SessionSummaryProps) {
  const c = useThemeColors();
  const styles = useSummaryStyles();
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={c.brandNavy} />
      </View>
      <View style={{ flex: 1 }}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text style={styles.value}>{value}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

type ActionFooterProps = {
  summary?: string;
  summaryHint?: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  finePrint?: string;
};

export function ScheduleActionFooter({
  summary,
  summaryHint,
  label,
  onPress,
  disabled,
  loading,
  testID,
  finePrint,
}: ActionFooterProps) {
  const c = useThemeColors();
  const styles = useFooterStyles();
  return (
    <View style={styles.root}>
      {summary ? (
        <View style={styles.summaryBox}>
          <Ionicons name="checkmark-circle" size={22} color={c.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.summary}>{summary}</Text>
            {summaryHint ? <Text style={styles.summaryHint}>{summaryHint}</Text> : null}
          </View>
        </View>
      ) : null}
      <Pressable
        testID={testID}
        style={[styles.btn, (disabled || loading) && styles.btnDisabled]}
        onPress={onPress}
        disabled={disabled || loading}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color={c.brandTextOn} />
        ) : (
          <>
            <Text style={styles.btnText}>{label}</Text>
            <Ionicons name="arrow-forward" size={18} color={c.brandTextOn} />
          </>
        )}
      </Pressable>
      {finePrint ? <Text style={styles.finePrint}>{finePrint}</Text> : null}
    </View>
  );
}

function useHeroStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.xs },
      trainer: {
        ...typography.caption,
        color: palette.brandNavy,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      },
      titleRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: space.sm,
      },
      title: {
        ...typography.titleMd,
        color: palette.text,
        fontWeight: "800",
        flexShrink: 1,
      },
      badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
      },
      badgeText: {
        ...typography.caption,
        color: palette.textMuted,
        fontWeight: "700",
      },
      subtitle: {
        ...typography.bodySm,
        color: palette.textMuted,
        lineHeight: 20,
      },
    })
  );
}

function useInfoStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        borderWidth: 1,
      },
      text: {
        ...typography.caption,
        flex: 1,
        lineHeight: 18,
        fontWeight: "500",
      },
    })
  );
}

function useSectionStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: { gap: space.sm },
      header: { gap: 2 },
      title: {
        ...typography.label,
        color: palette.text,
        fontWeight: "800",
        fontSize: 15,
      },
      subtitle: {
        ...typography.caption,
        color: palette.textMuted,
      },
    })
  );
}

function useFlowStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: space.sm,
        paddingHorizontal: space.xs,
      },
      step: { alignItems: "center", flex: 1, gap: 4 },
      dot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: palette.border,
        backgroundColor: palette.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
      },
      dotActive: {
        borderColor: palette.brandNavy,
        backgroundColor: palette.brandSubtle,
      },
      dotDone: {
        borderColor: palette.brandNavy,
        backgroundColor: palette.brandNavy,
      },
      dotNum: {
        fontSize: 11,
        fontWeight: "800",
        color: palette.textMuted,
      },
      dotNumActive: { color: palette.brandNavy },
      label: {
        fontSize: 10,
        fontWeight: "600",
        color: palette.textMuted,
        textAlign: "center",
      },
      labelActive: { color: palette.brandNavy, fontWeight: "800" },
      labelDone: { color: palette.text },
      connector: {
        flex: 0.35,
        height: 2,
        backgroundColor: palette.border,
        marginBottom: 18,
        borderRadius: 1,
      },
      connectorDone: { backgroundColor: palette.brandNavy },
    })
  );
}

function useSummaryStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.brandAccent + "44",
      },
      iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: palette.brandSubtle,
        alignItems: "center",
        justifyContent: "center",
      },
      label: {
        ...typography.caption,
        color: palette.textMuted,
        fontWeight: "600",
      },
      value: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
        marginTop: 2,
        lineHeight: 20,
      },
      hint: {
        ...typography.caption,
        color: palette.textSecondary,
        marginTop: 4,
      },
    })
  );
}

function useFooterStyles() {
  return useStaticStyles((palette) =>
    StyleSheet.create({
      root: {
        gap: space.sm,
        marginTop: space.sm,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
      },
      summaryBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: space.sm,
        padding: space.md,
        borderRadius: radii.lg,
        backgroundColor: palette.surfaceElevated,
        borderWidth: 1,
        borderColor: palette.success + "44",
      },
      summary: {
        ...typography.bodySm,
        color: palette.text,
        fontWeight: "700",
        lineHeight: 20,
      },
      summaryHint: {
        ...typography.caption,
        color: palette.textMuted,
        marginTop: 2,
      },
      btn: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.lg,
        paddingVertical: 15,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      },
      btnDisabled: { opacity: 0.55 },
      btnText: { ...typography.button, color: palette.brandTextOn },
      finePrint: {
        ...typography.caption,
        color: palette.textMuted,
        textAlign: "center",
        fontStyle: "italic",
      },
    })
  );
}
