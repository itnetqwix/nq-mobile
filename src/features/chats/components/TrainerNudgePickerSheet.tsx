import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  sendTraineeNudge,
  type NudgeTemplate,
} from "../../dashboard/api/trainerNotesApi";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  traineeId: string;
  traineeName?: string;
};

const TEMPLATES: { id: NudgeTemplate; icon: keyof typeof Ionicons.glyphMap; titleKey: string; subKey: string }[] = [
  {
    id: "comeback",
    icon: "refresh-circle-outline",
    titleKey: "trainerNudge.tplComebackTitle",
    subKey: "trainerNudge.tplComebackSub",
  },
  {
    id: "checkin",
    icon: "chatbubble-ellipses-outline",
    titleKey: "trainerNudge.tplCheckinTitle",
    subKey: "trainerNudge.tplCheckinSub",
  },
  {
    id: "promo",
    icon: "sparkles-outline",
    titleKey: "trainerNudge.tplPromoTitle",
    subKey: "trainerNudge.tplPromoSub",
  },
];

/**
 * "Bring-back" sheet. Pick a templated message or type a one-off
 * variant and send it as a regular chat message to the trainee. Behind
 * the scenes this hits `POST /trainer/trainee-nudge`, which:
 *   - rate-limits to 1 message per (trainer, trainee) per 24h
 *   - posts via the standard chat service (so it shows up in the room)
 *   - also fires a push notification
 */
export function TrainerNudgePickerSheet({
  visible,
  onClose,
  traineeId,
  traineeName,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<NudgeTemplate>("comeback");
  const [custom, setCustom] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      sendTraineeNudge({
        traineeId,
        template: picked,
        message: custom.trim() ? custom.trim() : undefined,
      }),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ["chat-room", traineeId] });
      Alert.alert(t("trainerNudge.successTitle"), t("trainerNudge.successBody"));
      setCustom("");
      onClose();
    },
    onError: (err: any) => {
      Alert.alert(t("trainerNudge.errorTitle"), err?.message ?? "Could not send.");
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.shell, { paddingTop: insets.top + 8 }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.titleMd, { color: c.text }]}>
              {t("trainerNudge.title")}
            </Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>
              {t("trainerNudge.subtitle", { name: traineeName ?? "this trainee" })}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
        </View>

        <View style={styles.list}>
          {TEMPLATES.map((tpl) => {
            const active = picked === tpl.id;
            return (
              <Pressable
                key={tpl.id}
                onPress={() => {
                  haptics.select();
                  setPicked(tpl.id);
                }}
                style={[
                  styles.tpl,
                  {
                    borderColor: active ? c.brandNavy : c.border,
                    backgroundColor: active ? c.brandSubtle : c.surfaceElevated,
                  },
                ]}
              >
                <View
                  style={[
                    styles.tplIcon,
                    {
                      backgroundColor: active ? c.brandNavy : c.surfaceMuted,
                    },
                  ]}
                >
                  <Ionicons
                    name={tpl.icon}
                    size={18}
                    color={active ? c.brandTextOn : c.brandNavy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tplTitle, { color: c.text }]}>
                    {t(tpl.titleKey)}
                  </Text>
                  <Text style={[styles.tplSub, { color: c.textMuted }]}>
                    {t(tpl.subKey)}
                  </Text>
                </View>
                {active ? (
                  <Ionicons name="checkmark-circle" size={20} color={c.brandNavy} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>
          {t("trainerNudge.customLabel")}
        </Text>
        <View
          style={[
            styles.editorBox,
            { borderColor: c.border, backgroundColor: c.surfaceElevated },
          ]}
        >
          <TextInput
            value={custom}
            onChangeText={setCustom}
            multiline
            placeholder={t("trainerNudge.customPlaceholder")}
            placeholderTextColor={c.textMuted}
            maxLength={1500}
            style={[styles.editorInput, { color: c.text }]}
          />
          <Text style={[styles.charCount, { color: c.textMuted }]}>
            {custom.length}/1500
          </Text>
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={[styles.sendBtn, { backgroundColor: c.brandNavy }]}
            accessibilityRole="button"
          >
            <Ionicons name="paper-plane" size={16} color={c.brandTextOn} />
            <Text style={[styles.sendText, { color: c.brandTextOn }]}>
              {mutation.isPending
                ? t("trainerNudge.sending")
                : t("trainerNudge.sendBtn")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      shell: { flex: 1, backgroundColor: palette.surface, padding: space.md, gap: space.md },
      row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
      sub: { ...typography.bodySm, marginTop: 2 },
      list: { gap: 8 },
      tpl: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: space.sm,
        borderRadius: radii.md,
        borderWidth: 1,
      },
      tplIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
      },
      tplTitle: { ...typography.bodyMd, fontWeight: "700" },
      tplSub: { ...typography.caption, marginTop: 2 },
      sectionLabel: {
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.6,
      },
      editorBox: {
        borderWidth: 1,
        borderRadius: radii.md,
        padding: space.sm,
        minHeight: 110,
      },
      editorInput: { ...typography.bodyMd, textAlignVertical: "top", minHeight: 80 },
      charCount: { fontSize: 10, fontWeight: "600", textAlign: "right" },
      actions: { marginTop: "auto" },
      sendBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 12,
        borderRadius: radii.pill,
      },
      sendText: { fontSize: 14, fontWeight: "800" },
    })
  );
}
