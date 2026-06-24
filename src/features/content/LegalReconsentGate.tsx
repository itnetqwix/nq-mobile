import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/context/AuthContext";
import { LegalTermsAcceptance } from "../auth/components/LegalTermsAcceptance";
import { acceptLegalDocuments, pendingLegalSlugsFromManifest } from "./api/userLegalApi";
import { fetchCmsManifest } from "./api/cmsApi";
import { queryKeys } from "../../lib/queryKeys";
import { navigationRef } from "../../navigation/navigationRef";
import { useAppTranslation } from "../../i18n/useAppTranslation";
import { colors, radii, space } from "../../theme";

function openLegal(slug: "terms" | "privacy") {
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

  const title =
    pendingSlugs.length === 2
      ? t("legal.reconsent.titleBoth")
      : pendingSlugs[0] === "privacy"
        ? t("legal.reconsent.titlePrivacy")
        : t("legal.reconsent.titleTerms");

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>NetQwix</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{t("legal.reconsent.body")}</Text>

          <View style={styles.links}>
            {pendingSlugs.includes("terms") ? (
              <Pressable onPress={() => openLegal("terms")}>
                <Text style={styles.link}>{t("auth.termsConditions")} →</Text>
              </Pressable>
            ) : null}
            {pendingSlugs.includes("privacy") ? (
              <Pressable onPress={() => openLegal("privacy")}>
                <Text style={styles.link}>{t("auth.privacyPolicy")} →</Text>
              </Pressable>
            ) : null}
          </View>

          <LegalTermsAcceptance
            value={accepted}
            onValueChange={setAccepted}
            onOpenLegal={openLegal}
          />
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
    marginBottom: space.md,
  },
  link: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.brandAccent,
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
