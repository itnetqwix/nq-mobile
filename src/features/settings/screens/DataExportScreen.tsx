/**
 * DataExportScreen — GDPR / India DPDP "export my data" flow.
 *
 * The screen surfaces:
 *   • A clear explanation of what's included.
 *   • A "Request export" CTA — the backend enqueues a job and emails the
 *     user when the archive is ready (typical 24-48 h SLA).
 *   • The latest export status (queued/processing/ready/failed) with a
 *     download link when ready.
 *
 * We don't try to render the archive contents on-device; the link expires
 * after 7 days and the user can re-request a new export anytime.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  Pill,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import {
  fetchDataExportStatus,
  requestDataExport,
  type DataExportStatus,
} from "../api/privacyApi";

const EXPORT_KEY = ["settings", "dataExport"] as const;

const STATUS_TONE: Record<DataExportStatus["state"], "neutral" | "info" | "success" | "warning" | "danger"> = {
  idle: "neutral",
  queued: "info",
  processing: "info",
  ready: "success",
  failed: "danger",
};

export function DataExportScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const qc = useQueryClient();

  const styles = useThemedStyles((p) =>
    StyleSheet.create({
      bulletRow: { flexDirection: "row", gap: space.sm, paddingVertical: 4 },
      statusCard: {
        flexDirection: "row",
        gap: space.md,
        alignItems: "center",
        padding: space.md,
        backgroundColor: p.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: p.border,
        marginBottom: space.md,
      },
    })
  );

  const q = useQuery({
    queryKey: EXPORT_KEY,
    queryFn: fetchDataExportStatus,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const requestMut = useMutation({
    mutationFn: () => requestDataExport("all"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: EXPORT_KEY });
      Alert.alert(
        t("dataExport.requestedTitle", { defaultValue: "Export queued" }),
        t("dataExport.requestedBody", {
          defaultValue:
            "We'll email you a download link as soon as your archive is ready. Most exports finish within 48 hours.",
        })
      );
    },
    onError: (e) =>
      Alert.alert(
        t("dataExport.errorTitle", { defaultValue: "Couldn't request export" }),
        getApiErrorMessage(e, t("common.error"))
      ),
  });

  const status: DataExportStatus = q.data ?? { state: "idle" };
  const canRequest = status.state === "idle" || status.state === "failed" || status.state === "ready";

  const handleRequest = useCallback(() => {
    Alert.alert(
      t("dataExport.confirmTitle", { defaultValue: "Request a data export?" }),
      t("dataExport.confirmBody", {
        defaultValue:
          "We'll bundle your profile, bookings, chat messages, clips metadata, and wallet activity into a ZIP archive and email you a download link.",
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("dataExport.confirmCta", { defaultValue: "Request" }),
          onPress: () => requestMut.mutate(),
        },
      ]
    );
  }, [requestMut, t]);

  const handleDownload = useCallback(async () => {
    if (!status.download_url) return;
    const supported = await Linking.canOpenURL(status.download_url);
    if (!supported) {
      Alert.alert(t("dataExport.linkErrorTitle", { defaultValue: "Couldn't open link" }), status.download_url);
      return;
    }
    void Linking.openURL(status.download_url);
  }, [status.download_url, t]);

  const statusLabel = useMemo(() => {
    switch (status.state) {
      case "queued":
        return t("dataExport.statusQueued", { defaultValue: "Queued" });
      case "processing":
        return t("dataExport.statusProcessing", { defaultValue: "Processing" });
      case "ready":
        return t("dataExport.statusReady", { defaultValue: "Ready" });
      case "failed":
        return t("dataExport.statusFailed", { defaultValue: "Failed" });
      case "idle":
      default:
        return t("dataExport.statusIdle", { defaultValue: "No active request" });
    }
  }, [status.state, t]);

  return (
    <ScreenContainer scroll padding="md" background={c.surface}>
      <SectionHeader label={t("dataExport.title", { defaultValue: "Export my data" })} />

      <Card variant="outlined" padding="md" style={{ marginBottom: space.md }}>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Ionicons name="cloud-download-outline" size={22} color={c.iconPrimary} />
          <Text style={[typography.bodySm, { color: c.textSecondary, flex: 1 }]}>
            {t("dataExport.lead", {
              defaultValue:
                "Get a copy of the data NetQwix holds about you. Required under GDPR (EU/UK) and India's DPDP Act, useful when moving accounts or auditing your information.",
            })}
          </Text>
        </View>
      </Card>

      <SectionHeader label={t("dataExport.includedTitle", { defaultValue: "What's included" })} />
      <Card variant="outlined" padding="md" style={{ marginBottom: space.md }}>
        {[
          {
            icon: "person-outline" as const,
            text: t("dataExport.includedProfile", {
              defaultValue: "Profile details, settings, login history.",
            }),
          },
          {
            icon: "calendar-outline" as const,
            text: t("dataExport.includedBookings", {
              defaultValue: "Bookings, lesson notes, and ratings.",
            }),
          },
          {
            icon: "chatbubbles-outline" as const,
            text: t("dataExport.includedChats", {
              defaultValue: "Chat messages you sent or received (decrypted where possible).",
            }),
          },
          {
            icon: "videocam-outline" as const,
            text: t("dataExport.includedClips", {
              defaultValue:
                "Clip metadata (titles, sports, timestamps). Raw videos are linked, not bundled, to keep the archive small.",
            }),
          },
          {
            icon: "wallet-outline" as const,
            text: t("dataExport.includedWallet", {
              defaultValue: "Wallet activity and receipts.",
            }),
          },
        ].map((row) => (
          <View key={row.icon} style={styles.bulletRow}>
            <Ionicons name={row.icon} size={18} color={c.iconPrimary} />
            <Text style={[typography.bodySm, { color: c.textSecondary, flex: 1 }]}>{row.text}</Text>
          </View>
        ))}
      </Card>

      <SectionHeader label={t("dataExport.statusHeader", { defaultValue: "Current request" })} />

      {q.isLoading ? (
        <ActivityIndicator color={c.brandAccent} style={{ marginVertical: space.md }} />
      ) : (
        <View style={styles.statusCard}>
          <Ionicons
            name={
              status.state === "ready"
                ? "checkmark-circle"
                : status.state === "failed"
                ? "alert-circle"
                : status.state === "idle"
                ? "ellipse-outline"
                : "time-outline"
            }
            size={28}
            color={
              status.state === "ready"
                ? c.success
                : status.state === "failed"
                ? c.danger
                : c.iconPrimary
            }
          />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Text style={[typography.subtitle, { color: c.text }]}>{statusLabel}</Text>
              <Pill label={statusLabel} tone={STATUS_TONE[status.state]} />
            </View>
            {status.requested_at ? (
              <Text style={[typography.caption, { color: c.textMuted, marginTop: 2 }]}>
                {t("dataExport.requestedOn", {
                  defaultValue: "Requested {{when}}",
                  when: new Date(status.requested_at).toLocaleString(),
                })}
              </Text>
            ) : null}
            {status.ready_at ? (
              <Text style={[typography.caption, { color: c.textMuted }]}>
                {t("dataExport.readyOn", {
                  defaultValue: "Ready {{when}}",
                  when: new Date(status.ready_at).toLocaleString(),
                })}
              </Text>
            ) : null}
            {status.expires_at ? (
              <Text style={[typography.caption, { color: c.textMuted }]}>
                {t("dataExport.expiresOn", {
                  defaultValue: "Link expires {{when}}",
                  when: new Date(status.expires_at).toLocaleString(),
                })}
              </Text>
            ) : null}
            {status.error ? (
              <Text style={[typography.bodySm, { color: c.danger, marginTop: space.xs }]}>
                {status.error}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {status.state === "ready" && status.download_url ? (
        <Button
          label={t("dataExport.download", { defaultValue: "Download archive" })}
          leftIcon="download-outline"
          onPress={() => void handleDownload()}
          style={{ marginBottom: space.sm }}
        />
      ) : null}

      <Button
        label={
          canRequest
            ? t("dataExport.request", { defaultValue: "Request a new export" })
            : t("dataExport.pending", { defaultValue: "Export in progress" })
        }
        variant={canRequest ? "primary" : "secondary"}
        onPress={handleRequest}
        disabled={!canRequest}
        loading={requestMut.isPending}
        leftIcon="cloud-upload-outline"
      />

      <Text style={[typography.caption, { color: c.textMuted, marginTop: space.md, textAlign: "center" }]}>
        {t("dataExport.helpFooter", {
          defaultValue:
            "Questions about what's exported or want a partial copy? Contact support from Settings → Contact us.",
        })}
      </Text>
    </ScreenContainer>
  );
}
