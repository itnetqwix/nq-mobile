import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Card,
  MorphRefreshScrollSurface,
  ScreenContainer,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
} from "../../../components/ui";
import { space, typography, useThemeColors } from "../../../theme";
import {
  fetchAuthSessions,
  revokeAuthSession,
  revokeOtherAuthSessions,
  type AuthSessionRow,
} from "../api/authSessionsApi";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { useAuth } from "../context/AuthContext";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function clientIcon(session: AuthSessionRow): keyof typeof Ionicons.glyphMap {
  if (session.platform === "ios" || session.platform === "android") return "phone-portrait-outline";
  if (session.clientType === "desktop") return "laptop-outline";
  if (session.clientType === "web") return "globe-outline";
  return "hardware-chip-outline";
}

function loginMethodLabel(method: string): string {
  if (method === "google") return "Google";
  if (method === "apple") return "Apple";
  if (method === "password") return "Email & password";
  return "Sign-in";
}

export function ActiveSessionsScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const { signOut } = useAuth();
  const [sessions, setSessions] = useState<AuthSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const rows = await fetchAuthSessions();
      setSessions(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("activeSessions.loadError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = (session: AuthSessionRow) => {
    Alert.alert(
      session.isCurrent ? t("activeSessions.signOutDeviceTitle") : t("activeSessions.removeSessionTitle"),
      session.isCurrent
        ? t("activeSessions.signOutDeviceBody")
        : t("activeSessions.removeSessionBody", { device: session.deviceLabel }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: session.isCurrent ? t("activeSessions.signOut") : t("activeSessions.remove"),
          style: "destructive",
          onPress: async () => {
            setBusyId(session.id);
            try {
              await revokeAuthSession(session.id);
              if (session.isCurrent) {
                await signOut();
                return;
              }
              await load(true);
            } catch (e: unknown) {
              Alert.alert(
                t("auth.activeSessions"),
                e instanceof Error ? e.message : t("activeSessions.sessionError")
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleRevokeOthers = () => {
    const others = sessions.filter((s) => !s.isCurrent);
    if (others.length === 0) {
      Alert.alert(t("auth.activeSessions"), t("activeSessions.noOthers"));
      return;
    }
    Alert.alert(
      t("activeSessions.signOutOthersTitle"),
      t("activeSessions.signOutOthersBody", { count: others.length }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("activeSessions.signOutOthers"),
          style: "destructive",
          onPress: async () => {
            setRevokingOthers(true);
            try {
              await revokeOtherAuthSessions();
              await load(true);
            } catch (e: unknown) {
              Alert.alert(
                "Sessions",
                e instanceof Error ? e.message : "Could not sign out other devices."
              );
            } finally {
              setRevokingOthers(false);
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    intro: {
      ...typography.body,
      color: c.textSecondary,
      marginBottom: space.md,
      lineHeight: 22,
    },
    card: { marginBottom: space.sm },
    row: { padding: space.md },
    titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
    title: { ...typography.subtitle, color: c.textPrimary, flex: 1 },
    badge: {
      backgroundColor: c.brandAccentSubtle,
      paddingHorizontal: space.sm,
      paddingVertical: 2,
      borderRadius: 6,
    },
    badgeText: { ...typography.caption, color: c.brandAccent, fontWeight: "600" },
    meta: { ...typography.caption, color: c.textMuted, marginTop: 4 },
    sessionId: { ...typography.caption, color: c.textMuted, marginTop: 6, fontFamily: "monospace" },
    revoke: { marginTop: space.sm, alignSelf: "flex-start" },
    revokeText: { ...typography.bodySm, color: c.error, fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space.xl },
    error: { ...typography.body, color: c.error, textAlign: "center", marginBottom: space.md },
    retry: { ...typography.bodySm, color: c.brandAccent, fontWeight: "600" },
    footerBtn: {
      marginTop: space.lg,
      padding: space.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
    },
    footerBtnText: { ...typography.body, color: c.error, fontWeight: "600" },
  });

  return (
    <ScreenContainer scroll={false}>
      <MorphRefreshScrollSurface
        onRefresh={() => void load(true)}
        externalRefreshing={refreshing}
        tintColor={c.brandAccent}
      >
        {({ refreshControl, onScroll, scrollEventThrottle }) => (
      <ScrollView
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl }}
        refreshControl={refreshControl}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
      >
        <Text style={styles.intro}>
          See where your account is signed in — phone, tablet, or web. Remove any session you do not recognize.
        </Text>

        {loading && !refreshing ? (
          <SkeletonGroup
            count={3}
            gap={space.md}
            renderRow={() => <Skeleton width="100%" height={96} radius={12} />}
          />
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load()}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <SectionHeader label={`Active sessions (${sessions.length})`} />
            {sessions.map((session) => (
              <Card key={session.id} variant="outlined" style={styles.card} padding={0}>
                <View style={styles.row}>
                  <View style={styles.titleRow}>
                    <Ionicons name={clientIcon(session)} size={22} color={c.iconPrimary} />
                    <Text style={styles.title}>{session.deviceLabel}</Text>
                    {session.isCurrent ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>This device</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.meta}>
                    {loginMethodLabel(session.loginMethod)} · {session.ipAddress}
                  </Text>
                  <Text style={styles.meta}>Signed in {formatWhen(session.createdAt)}</Text>
                  <Text style={styles.meta}>Last active {formatWhen(session.lastUsedAt)}</Text>
                  <Text style={styles.sessionId}>Session {session.publicId}</Text>
                  <Pressable
                    style={styles.revoke}
                    onPress={() => handleRevoke(session)}
                    disabled={busyId === session.id}
                  >
                    {busyId === session.id ? (
                      <ActivityIndicator size="small" color={c.error} />
                    ) : (
                      <Text style={styles.revokeText}>
                        {session.isCurrent ? "Sign out on this device" : "Remove session"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </Card>
            ))}

            {sessions.some((s) => !s.isCurrent) ? (
              <Pressable
                style={styles.footerBtn}
                onPress={handleRevokeOthers}
                disabled={revokingOthers}
              >
                {revokingOthers ? (
                  <ActivityIndicator color={c.error} />
                ) : (
                  <Text style={styles.footerBtnText}>Sign out all other devices</Text>
                )}
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
        )}
      </MorphRefreshScrollSurface>
    </ScreenContainer>
  );
}
