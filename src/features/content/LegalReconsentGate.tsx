import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/context/AuthContext";
import { acceptLegalDocuments, pendingLegalSlugsFromManifest } from "./api/userLegalApi";
import { fetchCmsManifest, type CmsLegalSlug } from "./api/cmsApi";
import { queryKeys } from "../../lib/queryKeys";
import { navigationRef } from "../../navigation/navigationRef";
import { useAppTranslation } from "../../i18n/useAppTranslation";
import { colors, radii, space } from "../../theme";

function openLegal(slug: CmsLegalSlug) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(
    "Main" as never,
    {
      screen: "Tabs",
      params: {
        screen: "Home",
        params: {
          screen: "LegalDocument",
          params: { slug },
        },
      },
    } as never
  );
}

function reconsentTitle(
  pending: CmsLegalSlug[],
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (pending.length >= 3) {
    return t("legal.reconsent.titleMultiple", {
      defaultValue: "We've updated our legal policies",
    });
  }
  if (pending.length === 2) {
    const labels = pending.map((slug) => slugLabel(slug, t)).join(" & ");
    return t("legal.reconsent.titlePair", {
      defaultValue: "We've updated our {{labels}}",
      labels,
    });
  }
  const slug = pending[0];
  if (!slug) return t("legal.reconsent.titleMultiple");
  if (slug === "privacy") return t("legal.reconsent.titlePrivacy");
  if (slug === "terms") return t("legal.reconsent.titleTerms");
  if (slug === "cancellation") return t("legal.reconsent.titleCancellation");
  return t("legal.reconsent.titleRefund");
}

function slugLabel(slug: CmsLegalSlug, t: (key: string) => string): string {
  switch (slug) {
    case "privacy":
      return t("settings.privacyPolicy");
    case "terms":
      return t("settings.termsConditions");
    case "cancellation":
      return t("settings.cancellationPolicy");
    case "refund":
      return t("settings.refundPolicy");
    default:
      return slug;
  }
}

export function LegalReconsentGate() {
  const { t } = useAppTranslation();
  const { status, user, refreshUser } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: manifest } = useQuery({
    queryKey: queryKeys.content.cmsManifest,
    queryFn: fetchCmsManifest,
    enabled: status === "signedIn",
    staleTime: 30_000,
  });

  const pendingSlugs = useMemo(() => {
    if (status !== "signedIn") return [];
    return pendingLegalSlugsFromManifest(user, manifest?.legal);
  }, [status, user, manifest?.legal]);

  const visible = pendingSlugs.length > 0;

  const handleAccept = useCallback(async () => {
    if (!accepted) {
      Alert.alert(t("legal.reconsent.alertTitle"), t("legal.reconsent.mustAccept"));
      return;
    }
    setSubmitting(true);
    try {
      await acceptLegalDocuments();
      await refreshUser();
      setAccepted(false);
    } catch (e) {
      Alert.alert(
        t("legal.reconsent.alertTitle"),
        e instanceof Error ? e.message : t("legal.reconsent.failed")
      );
    } finally {
      setSubmitting(false);
    }
  }, [accepted, refreshUser, t]);

  if (!visible) return null;

  const title = reconsentTitle(pendingSlugs, t);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>NetQwix</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{t("legal.reconsent.body")}</Text>

          <View style={styles.links}>
            {pendingSlugs.map((slug) => (
              <Pressable key={slug} onPress={() => openLegal(slug)} style={styles.linkRow}>
                <Text style={styles.link}>{slugLabel(slug, t)} →</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.acceptRow}>
            <Switch
              value={accepted}
              onValueChange={setAccepted}
              accessibilityLabel={t("legal.reconsent.acceptA11y", {
                defaultValue: "Accept updated policies",
              })}
            />
            <Text style={styles.acceptText}>
              {t("legal.reconsent.acceptLabel", {
                defaultValue:
                  "I have read and agree to the updated policies listed above.",
              })}
              <Text style={styles.required}> *</Text>
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.button, (!accepted || submitting) && styles.buttonDisabled]}
            disabled={!accepted || submitting}
            onPress={() => void handleAccept()}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t("legal.reconsent.continue")}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: space.lg,
    paddingTop: space.xl * 2,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.brand,
    marginBottom: space.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginBottom: space.md,
    lineHeight: 30,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: space.lg,
  },
  links: {
    gap: space.sm,
    marginBottom: space.lg,
  },
  linkRow: {
    paddingVertical: 4,
  },
  link: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.brandAccent,
  },
  acceptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    marginTop: space.sm,
  },
  acceptText: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  required: {
    color: colors.danger,
    fontWeight: "700",
  },
  footer: {
    padding: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
