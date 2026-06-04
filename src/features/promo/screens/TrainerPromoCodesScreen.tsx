import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Button, Card, Pill, ScreenContainer } from "../../../components/ui";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { queryKeys } from "../../../lib/queryKeys";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { useAuth } from "../../auth/context/AuthContext";
import {
  buildCoachPromoShareMessage,
  createTrainerPromoCode,
  fetchTrainerPromoCodes,
  toggleTrainerPromoCode,
  updateTrainerPromoCode,
  type TrainerPromoForm,
  type TrainerPromoRow,
} from "../api/trainerPromoApi";

const EMPTY_FORM: TrainerPromoForm = {
  code: "",
  description: "",
  display_label: "",
  discount_type: "percentage",
  discount_value: 15,
  min_order_amount: 0,
  max_discount_amount: 0,
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  usage_limit: 0,
  per_user_limit: 1,
  applicable_booking_types: ["all"],
  is_active: true,
  is_visible: true,
};

function generateCoachCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function promoStatus(row: TrainerPromoRow): "active" | "paused" | "expired" | "upcoming" {
  const now = Date.now();
  if (!row.is_active) return "paused";
  if (new Date(row.end_date).getTime() < now) return "expired";
  if (new Date(row.start_date).getTime() > now) return "upcoming";
  return "active";
}

function discountLabel(row: TrainerPromoRow): string {
  return row.discount_type === "percentage"
    ? `${row.discount_value}% off`
    : `$${row.discount_value} off`;
}

export function TrainerPromoCodesScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const qc = useQueryClient();
  const { user } = useAuth();
  const coachName =
    String((user as Record<string, unknown>)?.fullname ?? "").trim() || "Coach";

  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<TrainerPromoRow | null>(null);
  const [form, setForm] = useState<TrainerPromoForm>({ ...EMPTY_FORM });

  const listQuery = useQuery({
    queryKey: queryKeys.trainer.promoCodes,
    queryFn: fetchTrainerPromoCodes,
  });

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: queryKeys.trainer.promoCodes });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || form.code.trim().length < 4) {
        throw new Error(t("trainerPromo.errors.codeLength"));
      }
      if (!form.discount_value || form.discount_value <= 0) {
        throw new Error(t("trainerPromo.errors.discount"));
      }
      if (!form.start_date || !form.end_date) {
        throw new Error(t("trainerPromo.errors.dates"));
      }
      if (new Date(form.end_date) <= new Date(form.start_date)) {
        throw new Error(t("trainerPromo.errors.endAfterStart"));
      }
      if (editRow) {
        return updateTrainerPromoCode(editRow._id, form);
      }
      return createTrainerPromoCode(form);
    },
    onSuccess: () => {
      setFormOpen(false);
      setEditRow(null);
      invalidate();
    },
    onError: (e) => Alert.alert(t("trainerPromo.errors.title"), getApiErrorMessage(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleTrainerPromoCode(id),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t("trainerPromo.errors.title"), getApiErrorMessage(e)),
  });

  const openCreate = useCallback(() => {
    setEditRow(null);
    setForm({
      ...EMPTY_FORM,
      code: generateCoachCode(),
      display_label: t("trainerPromo.defaultLabel", { name: coachName }),
    });
    setFormOpen(true);
  }, [coachName, t]);

  const openEdit = useCallback((row: TrainerPromoRow) => {
    setEditRow(row);
    setForm({
      code: row.code,
      description: row.description ?? "",
      display_label: row.display_label ?? "",
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      min_order_amount: row.min_order_amount ?? 0,
      max_discount_amount: row.max_discount_amount ?? 0,
      start_date: row.start_date ? row.start_date.slice(0, 10) : EMPTY_FORM.start_date,
      end_date: row.end_date ? row.end_date.slice(0, 10) : EMPTY_FORM.end_date,
      usage_limit: row.usage_limit ?? 0,
      per_user_limit: row.per_user_limit ?? 1,
      applicable_booking_types: (row.applicable_booking_types as TrainerPromoForm["applicable_booking_types"]) ?? [
        "all",
      ],
      is_active: row.is_active,
      is_visible: row.is_visible,
    });
    setFormOpen(true);
  }, []);

  const sharePromo = useCallback(async (row: TrainerPromoRow) => {
    const message = buildCoachPromoShareMessage(row.code, row.display_label);
    try {
      await Share.share({ message });
    } catch {
      try {
        const Clipboard = require("expo-clipboard") as {
          setStringAsync: (s: string) => Promise<void>;
        };
        await Clipboard.setStringAsync(message);
        Alert.alert(t("trainerPromo.copiedTitle"), t("trainerPromo.copiedBody"));
      } catch {
        Alert.alert(t("trainerPromo.errors.title"), message);
      }
    }
  }, [t]);

  const rows = listQuery.data ?? [];

  const stats = useMemo(() => {
    let active = 0;
    let totalUses = 0;
    for (const r of rows) {
      if (promoStatus(r) === "active") active += 1;
      totalUses += r.usage_count ?? 0;
    }
    return { active, totalUses, total: rows.length };
  }, [rows]);

  const setField = <K extends keyof TrainerPromoForm>(key: K, value: TrainerPromoForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <ScreenContainer
      scroll
      clearFloatingTabBar
      refreshing={listQuery.isRefetching}
      onRefresh={() => listQuery.refetch()}
    >
      <Text style={styles.lead}>{t("trainerPromo.lead")}</Text>
      <Card variant="outlined" style={styles.infoCard}>
        <Text style={styles.infoText}>{t("trainerPromo.fundingNote")}</Text>
      </Card>

      <View style={styles.statsRow}>
        <StatBox label={t("trainerPromo.stats.active")} value={String(stats.active)} />
        <StatBox label={t("trainerPromo.stats.codes")} value={String(stats.total)} />
        <StatBox label={t("trainerPromo.stats.uses")} value={String(stats.totalUses)} />
      </View>

      <View style={styles.toolbar}>
        <Button label={t("trainerPromo.create")} onPress={openCreate} />
      </View>

      {listQuery.isLoading ? (
        <ActivityIndicator style={{ marginTop: space.xl }} color={c.brandAccent} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>{t("trainerPromo.empty")}</Text>
      ) : (
        rows.map((row) => (
          <PromoCard
            key={row._id}
            row={row}
            onShare={() => sharePromo(row)}
            onEdit={() => openEdit(row)}
            onToggle={() => toggleMutation.mutate(row._id)}
            toggling={toggleMutation.isPending}
          />
        ))
      )}

      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalShell}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editRow ? t("trainerPromo.editTitle") : t("trainerPromo.createTitle")}
            </Text>
            <Pressable onPress={() => setFormOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={28} color={c.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldHint}>{t("trainerPromo.fundingNote")}</Text>
            <Field label={t("trainerPromo.fields.code")}>
              <TextInput
                style={styles.input}
                value={form.code}
                onChangeText={(v) => setField("code", v.toUpperCase())}
                editable={!editRow}
                autoCapitalize="characters"
                placeholder="COACH20"
              />
              {!editRow ? (
                <Pressable onPress={() => setField("code", generateCoachCode())}>
                  <Text style={styles.link}>{t("trainerPromo.generate")}</Text>
                </Pressable>
              ) : null}
            </Field>
            <Field label={t("trainerPromo.fields.label")}>
              <TextInput
                style={styles.input}
                value={form.display_label}
                onChangeText={(v) => setField("display_label", v)}
                placeholder={t("trainerPromo.fields.labelPlaceholder")}
              />
            </Field>
            <View style={styles.row2}>
              <View style={styles.half}>
                <Field label={t("trainerPromo.fields.type")}>
                  <View style={styles.segmentRow}>
                    {(["percentage", "fixed_amount"] as const).map((dt) => (
                      <Pressable
                        key={dt}
                        style={[styles.segment, form.discount_type === dt && styles.segmentOn]}
                        onPress={() => setField("discount_type", dt)}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            form.discount_type === dt && styles.segmentTextOn,
                          ]}
                        >
                          {dt === "percentage"
                            ? t("trainerPromo.fields.percent")
                            : t("trainerPromo.fields.fixed")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Field>
              </View>
              <View style={styles.half}>
                <Field label={t("trainerPromo.fields.value")}>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={String(form.discount_value)}
                    onChangeText={(v) => setField("discount_value", Number(v) || 0)}
                  />
                </Field>
              </View>
            </View>
            <View style={styles.row2}>
              <View style={styles.half}>
                <Field label={t("trainerPromo.fields.start")}>
                  <TextInput
                    style={styles.input}
                    value={form.start_date}
                    onChangeText={(v) => setField("start_date", v)}
                    placeholder="YYYY-MM-DD"
                  />
                </Field>
              </View>
              <View style={styles.half}>
                <Field label={t("trainerPromo.fields.end")}>
                  <TextInput
                    style={styles.input}
                    value={form.end_date}
                    onChangeText={(v) => setField("end_date", v)}
                    placeholder="YYYY-MM-DD"
                  />
                </Field>
              </View>
            </View>
            <View style={styles.row2}>
              <View style={styles.half}>
                <Field label={t("trainerPromo.fields.usageLimit")}>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={String(form.usage_limit ?? 0)}
                    onChangeText={(v) => setField("usage_limit", Number(v) || 0)}
                  />
                </Field>
              </View>
              <View style={styles.half}>
                <Field label={t("trainerPromo.fields.perUser")}>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={String(form.per_user_limit ?? 1)}
                    onChangeText={(v) => setField("per_user_limit", Number(v) || 0)}
                  />
                </Field>
              </View>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t("trainerPromo.fields.visible")}</Text>
              <Switch
                value={!!form.is_visible}
                onValueChange={(v) => setField("is_visible", v)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t("trainerPromo.fields.active")}</Text>
              <Switch value={!!form.is_active} onValueChange={(v) => setField("is_active", v)} />
            </View>
            <Button
              label={editRow ? t("trainerPromo.save") : t("trainerPromo.create")}
              onPress={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              style={{ marginTop: space.md }}
            />
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PromoCard({
  row,
  onShare,
  onEdit,
  onToggle,
  toggling,
}: {
  row: TrainerPromoRow;
  onShare: () => void;
  onEdit: () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const status = promoStatus(row);
  const pillTone =
    status === "active"
      ? "success"
      : status === "expired"
        ? "danger"
        : status === "upcoming"
          ? "warning"
          : "neutral";

  return (
    <Card variant="outlined" style={styles.promoCard}>
      <View style={styles.promoTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.code}>{row.code}</Text>
          <Text style={styles.sub}>
            {row.display_label || discountLabel(row)} · {discountLabel(row)}
          </Text>
        </View>
        <Pill label={t(`trainerPromo.status.${status}`)} tone={pillTone} />
      </View>
      <Text style={styles.meta}>
        {t("trainerPromo.usage", {
          count: row.usage_count ?? 0,
          limit: row.usage_limit > 0 ? row.usage_limit : "∞",
        })}
      </Text>
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={onShare}>
          <Ionicons name="share-outline" size={18} color={c.brandAccent} />
          <Text style={styles.actionText}>{t("trainerPromo.share")}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onEdit}>
          <Ionicons name="create-outline" size={18} color={c.text} />
          <Text style={styles.actionText}>{t("trainerPromo.edit")}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onToggle} disabled={toggling}>
          <Ionicons
            name={row.is_active ? "pause-circle-outline" : "play-circle-outline"}
            size={18}
            color={c.textMuted}
          />
          <Text style={styles.actionText}>
            {row.is_active ? t("trainerPromo.pause") : t("trainerPromo.resume")}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      lead: { ...typography.body, color: palette.textMuted, marginBottom: space.md },
      infoCard: { marginBottom: space.md },
      infoText: { ...typography.bodySmall, color: palette.textMuted },
      statsRow: { flexDirection: "row", gap: space.sm, marginBottom: space.md },
      statBox: {
        flex: 1,
        backgroundColor: palette.surfaceMuted,
        borderRadius: radii.md,
        padding: space.md,
        alignItems: "center",
      },
      statValue: { fontSize: 22, fontWeight: "700", color: palette.text },
      statLabel: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
      toolbar: { marginBottom: space.md },
      empty: { ...typography.body, color: palette.textMuted, textAlign: "center", marginTop: space.xl },
      promoCard: { marginBottom: space.sm },
      promoTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
      code: { fontSize: 18, fontWeight: "700", fontFamily: "monospace", color: palette.text },
      sub: { ...typography.bodySmall, color: palette.textMuted, marginTop: 2 },
      meta: { ...typography.caption, color: palette.textMuted, marginTop: space.sm },
      actions: { flexDirection: "row", marginTop: space.md, gap: space.md },
      actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
      actionText: { ...typography.bodySmall, color: palette.text },
      modalShell: { flex: 1, backgroundColor: palette.surface },
      modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: space.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      modalTitle: { fontSize: 18, fontWeight: "700", color: palette.text },
      modalScroll: { padding: space.md, paddingBottom: space.xxl },
      fieldHint: { ...typography.bodySmall, color: palette.textMuted, marginBottom: space.md },
      field: { marginBottom: space.md },
      fieldLabel: { ...typography.caption, color: palette.textMuted, marginBottom: 6 },
      input: {
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.md,
        paddingHorizontal: space.md,
        paddingVertical: 10,
        color: palette.text,
        backgroundColor: palette.surface,
      },
      link: { ...typography.bodySmall, color: palette.brandAccent, marginTop: 6 },
      row2: { flexDirection: "row", gap: space.sm },
      half: { flex: 1 },
      segmentRow: { flexDirection: "row", gap: 6 },
      segment: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
      },
      segmentOn: { backgroundColor: palette.brandAccent, borderColor: palette.brandAccent },
      segmentText: { ...typography.bodySmall, color: palette.text },
      segmentTextOn: { color: palette.brandTextOn, fontWeight: "600" },
      switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: space.sm,
      },
      switchLabel: { ...typography.body, color: palette.text },
    })
  );
}
