import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Banner, Button, KeyboardAwareScrollScreen, Skeleton } from "../../../components/ui";
import {
  radii,
  space,
  typography,
  useThemeColors,
  useThemedStyles,
} from "../../../theme";
import { fetchMyReferrals } from "../../home/api/homeApi";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import { useAuth } from "../../auth/context/AuthContext";
import { WEB_APP_ORIGIN } from "../../../config/env";
import { haptics } from "../../../lib/haptics";
import { AccountType } from "../../../constants/accountType";
import {
  fetchReferralProgram,
  postReferralInvites,
  type ReferralRewardPreview,
  type ReferralRewardPreviewPoints,
} from "../../referral/api/referralApi";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TrackerTab = "all" | "pending" | "joined";

type ReferralRow = {
  _id?: string;
  email?: string;
  createdAt?: string;
  joined?: boolean;
  joinedAt?: string | null;
  joinedUserId?: string | null;
  targetAccountType?: string;
  joinedAccountType?: string | null;
};

/**
 * Build a referral link that the deep-link signup screen can consume.
 *
 * The web signup page reads `?ref=<referrerUserId>` to attribute a new
 * account back to its inviter (see backend `inviteFriend` which writes the
 * referrer id on the `ReferredUser` record). Falls back to the bare web
 * origin if we don't have a user id (e.g. mid-onboarding before /auth/me
 * has populated).
 */
function buildReferralLink(userId: string | null | undefined, code?: string | null): string {
  if (code) return `${WEB_APP_ORIGIN}/signup?code=${encodeURIComponent(code)}`;
  if (!userId) return WEB_APP_ORIGIN;
  return `${WEB_APP_ORIGIN}/signup?ref=${encodeURIComponent(userId)}`;
}

function rewardSummaryPoints(preview: ReferralRewardPreviewPoints | undefined): string {
  if (!preview) return "";
  const parts: string[] = [];
  if (preview.referrerSignupPoints > 0) {
    parts.push(`${preview.referrerSignupPoints} pts signup`);
  }
  if (preview.referrerFirstBookingPoints > 0) {
    parts.push(`+${preview.referrerFirstBookingPoints} pts first lesson`);
  }
  return parts.join(" · ");
}

export function InviteFriendsScreen() {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useInviteStyles();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TrackerTab>("all");
  const [composerOpen, setComposerOpen] = useState(true);
  const [inviteTarget, setInviteTarget] = useState<typeof AccountType.TRAINEE | typeof AccountType.TRAINER>(
    AccountType.TRAINEE
  );

  const programQuery = useQuery({
    queryKey: queryKeys.referral.program,
    queryFn: fetchReferralProgram,
    staleTime: 120_000,
  });
  const program = programQuery.data;

  const referralLink = useMemo(() => {
    if (program?.webLink) return program.webLink;
    return buildReferralLink(
      (user as { _id?: string } | null | undefined)?._id,
      program?.referralCode
    );
  }, [user, program]);

  const activeRewardPreviewPoints = useMemo(() => {
    if (!program?.rewardMatrixPoints) return undefined;
    return inviteTarget === AccountType.TRAINER
      ? program.rewardMatrixPoints.inviteTrainer
      : program.rewardMatrixPoints.inviteTrainee;
  }, [program, inviteTarget]);

  const referralMessage = useMemo(
    () =>
      t("invites.shareMessage", {
        defaultValue:
          "Join me on NetQwix for coaching — we earn points when you sign up: {{link}}",
        link: referralLink,
      }),
    [referralLink, t]
  );

  const { data: referrals = [], isLoading: loadingHistory, isRefetching } = useQuery({
    queryKey: queryKeys.user.referrals,
    queryFn: fetchMyReferrals,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const stats = useMemo(() => {
    const total = program?.stats.invitesSent ?? referrals.length;
    const joined = program?.stats.registered ?? referrals.filter((r: ReferralRow) => r.joined).length;
    const earnedPoints = program?.stats.totalEarnedPoints ?? 0;
    const pointsBalance = program?.stats.pointsBalance ?? 0;
    return { total, joined, pending: total - joined, earnedPoints, pointsBalance };
  }, [referrals, program]);

  const filteredReferrals = useMemo(() => {
    const rows = referrals as ReferralRow[];
    if (tab === "pending") return rows.filter((r) => !r.joined);
    if (tab === "joined") return rows.filter((r) => r.joined);
    return rows;
  }, [referrals, tab]);

  const handleTextChange = (val: string) => {
    if (val.endsWith(",") || val.endsWith(" ") || val.endsWith(";")) {
      const raw = val.slice(0, -1).trim().toLowerCase();
      if (raw && emailRegex.test(raw) && !chips.includes(raw)) {
        setChips((prev) => [...prev, raw]);
        setText("");
        setErr("");
        return;
      } else if (raw && !emailRegex.test(raw)) {
        setErr(t("invites.invalidEmail", { email: raw }));
      }
      setText("");
      return;
    }
    setText(val);
    if (err) setErr("");
  };

  const handleSubmitEditing = () => {
    const raw = text.trim().toLowerCase();
    if (raw && emailRegex.test(raw) && !chips.includes(raw)) {
      setChips((prev) => [...prev, raw]);
      setText("");
      setErr("");
    } else if (raw && !emailRegex.test(raw)) {
      setErr(t("invites.invalidEmail", { email: raw }));
    }
  };

  const removeChip = (email: string) => {
    setChips((prev) => prev.filter((e) => e !== email));
  };

  const allEmails = useMemo(() => {
    const extra = text.trim().toLowerCase();
    if (extra && emailRegex.test(extra) && !chips.includes(extra)) {
      return [...chips, extra];
    }
    return chips;
  }, [chips, text]);

  const sendInvites = useCallback(async () => {
    setErr("");
    if (allEmails.length === 0) {
      setErr(t("invites.needOneEmail"));
      return;
    }
    if (allEmails.length > 10) {
      setErr(t("invites.maxTen"));
      return;
    }
    setLoading(true);
    let ok: string[] = [];
    let failed: { email: string; reason: string }[] = [];
    try {
      const { results } = await postReferralInvites(allEmails, inviteTarget);
      for (const row of results) {
        if (row.ok) ok.push(row.email);
        else failed.push({ email: row.email, reason: row.error ?? "Send failed" });
      }
    } catch (e) {
      failed = allEmails.map((email) => ({
        email,
        reason: getApiErrorMessage(e, "Send failed"),
      }));
    }
    setLoading(false);
    if (failed.length && ok.length) {
      Alert.alert(
        t("invites.someFailedTitle"),
        t("invites.someFailedBody", {
          sent: ok.length,
          failed: failed.map((f) => `${f.email} (${f.reason})`).join(", "),
        })
      );
      setChips(failed.map((f) => f.email));
    } else if (failed.length) {
      setErr(t("invites.failedFor", { emails: failed.map((f) => f.email).join(", ") }));
    } else {
      setChips([]);
      setText("");
      setErr("");
      Alert.alert(
        t("invites.sentTitle"),
        t("invites.sentBody", { count: ok.length })
      );
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.user.referrals });
    queryClient.invalidateQueries({ queryKey: queryKeys.referral.program });
    queryClient.invalidateQueries({ queryKey: queryKeys.referral.invites });
  }, [allEmails, inviteTarget, queryClient, t]);

  const handleShareWhatsApp = async () => {
    haptics.tap();
    const url = `whatsapp://send?text=${encodeURIComponent(referralMessage)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fall through to fallback */
    }
    // Fall back to the universal share sheet so the user can still send via
    // any other installed messaging app.
    void Share.share({ message: referralMessage });
  };

  const handleShareSms = async () => {
    haptics.tap();
    const url = `sms:?body=${encodeURIComponent(referralMessage)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* fall through */
    }
    void Share.share({ message: referralMessage });
  };

  const handleCopyLink = async () => {
    haptics.tap();
    try {
      // `expo-clipboard` is loaded via runtime require so this file does not
      // hard-import a module that may be absent from `package.json` on slim
      // builds. The same trick is used elsewhere (e.g. ChatRoomScreen) and
      // matches Expo's recommended pattern when a clipboard fallback exists.
      //
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const Clipboard = require("expo-clipboard") as {
        setStringAsync: (s: string) => Promise<void>;
      };
      await Clipboard.setStringAsync(referralLink);
      Alert.alert(
        t("invites.linkCopiedTitle", { defaultValue: "Link copied" }),
        t("invites.linkCopiedBody", {
          defaultValue: "Paste it anywhere to share.",
        })
      );
    } catch {
      // Fall back to the share sheet so the user still has a way out.
      void Share.share({ message: referralLink });
    }
  };

  const handleShareNative = () => {
    haptics.tap();
    void Share.share({ message: referralMessage });
  };

  return (
    <KeyboardAwareScrollScreen style={styles.root} contentContainerStyle={styles.content}>
      {/* Hero card with perk callout */}
      <View style={styles.hero}>
        <View style={[styles.heroIconWrap, { backgroundColor: c.brandSubtle }]}>
          <Ionicons name="gift-outline" size={32} color={c.brandNavy} />
        </View>
        <Text style={[styles.heroTitle, { color: c.text }]}>
          {t("invites.heroTitle", {
            defaultValue: "Refer coaches and athletes, earn wallet credits",
          })}
        </Text>
        <Text style={[styles.heroSub, { color: c.textMuted }]}>
          {t("invites.heroSubtitle", {
            defaultValue:
              "Invite anyone to join as a trainee or trainer. When they sign up and complete their first lesson, you earn cash credits in your NetQwix wallet.",
          })}
        </Text>
        {program?.referralCode ? (
          <Text style={[styles.codePill, { color: c.brandNavy, backgroundColor: c.brandSubtle }]}>
            {t("invites.yourCode", { defaultValue: "Your code" })}: {program.referralCode}
          </Text>
        ) : null}
      </View>

      {/* Stats card */}
      <View style={styles.statsCard}>
        <StatBlock
          icon="paper-plane-outline"
          label={t("invites.statInvited", { defaultValue: "Invited" })}
          value={stats.total}
        />
        <View style={styles.statDivider} />
        <StatBlock
          icon="people-outline"
          label={t("invites.statJoined", { defaultValue: "Joined" })}
          value={stats.joined}
          highlight
        />
        <View style={styles.statDivider} />
        <StatBlock
          icon="star-outline"
          label={t("invites.statPoints", { defaultValue: "Points" })}
          value={stats.pointsBalance}
          compact
        />
      </View>

      <View style={[styles.card, { backgroundColor: c.brandSubtle }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>
          {t("points.inviteHowTitle", { defaultValue: "How points work" })}
        </Text>
        <Text style={[styles.rewardLine, { color: c.textMuted }]}>
          {t("points.inviteHowBody", {
            defaultValue:
              "Earn 1–5 points per action (lessons, reviews, referrals). Redeem 100 points for $5 wallet credit in the Wallet tab.",
          })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, { color: c.text }]}>
          {t("invites.inviteAsTitle", { defaultValue: "Invite them to join as" })}
        </Text>
        <View style={styles.targetRow}>
          <TargetChip
            label={t("invites.targetTrainee", { defaultValue: "Trainee" })}
            selected={inviteTarget === AccountType.TRAINEE}
            onPress={() => setInviteTarget(AccountType.TRAINEE)}
          />
          <TargetChip
            label={t("invites.targetTrainer", { defaultValue: "Trainer / coach" })}
            selected={inviteTarget === AccountType.TRAINER}
            onPress={() => setInviteTarget(AccountType.TRAINER)}
          />
        </View>
        <Text style={[styles.rewardLine, { color: c.textMuted }]}>
          {t("invites.rewardYouEarnPoints", {
            defaultValue: "You earn {{amount}} when they join",
            amount: rewardSummaryPoints(activeRewardPreviewPoints) || "—",
          })}
        </Text>
        {activeRewardPreviewPoints && activeRewardPreviewPoints.refereeSignupPoints > 0 ? (
          <Text style={[styles.rewardLine, { color: c.textMuted }]}>
            {t("invites.rewardTheyGetPoints", {
              defaultValue: "They get {{amount}} on signup",
              amount: `${activeRewardPreviewPoints.refereeSignupPoints} pts`,
            })}
          </Text>
        ) : null}
      </View>

      {/* Quick share row */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { color: c.text }]}>
          {t("invites.shareLinkTitle", { defaultValue: "Share your link" })}
        </Text>
        <Text style={[styles.cardSub, { color: c.textMuted }]} numberOfLines={1}>
          {referralLink}
        </Text>
        <View style={styles.shareRow}>
          <ShareAction
            icon="logo-whatsapp"
            label={t("invites.shareWhatsapp", { defaultValue: "WhatsApp" })}
            onPress={handleShareWhatsApp}
            tint="#25D366"
          />
          <ShareAction
            icon="chatbox-outline"
            label={t("invites.shareSms", { defaultValue: "SMS" })}
            onPress={handleShareSms}
          />
          <ShareAction
            icon="link-outline"
            label={t("invites.shareCopyLink", { defaultValue: "Copy link" })}
            onPress={handleCopyLink}
          />
          <ShareAction
            icon="share-outline"
            label={t("invites.shareMore", { defaultValue: "More" })}
            onPress={handleShareNative}
          />
        </View>
      </View>

      {/* Email composer */}
      <View style={styles.card}>
        <Pressable
          onPress={() => setComposerOpen((v) => !v)}
          style={styles.composerHeader}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: c.text }]}>
              {t("invites.title")}
            </Text>
            <Text style={[styles.cardSub, { color: c.textMuted }]}>
              {t("invites.subtitleExpanded", {
                defaultValue:
                  "Enter one or more emails. We will send your friend a personal invite to join NetQwix.",
              })}
            </Text>
          </View>
          <Ionicons
            name={composerOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color={c.textMuted}
          />
        </Pressable>

        {composerOpen ? (
          <View style={{ gap: space.sm }}>
            <Text style={styles.label}>{t("invites.emailLabel")}</Text>
            <View style={styles.chipContainer}>
              {chips.map((email) => (
                <View key={email} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {email}
                  </Text>
                  <Pressable onPress={() => removeChip(email)} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={c.textMuted} />
                  </Pressable>
                </View>
              ))}
              <TextInput
                style={styles.chipInput}
                placeholder={
                  chips.length === 0
                    ? t("invites.emailPlaceholder")
                    : t("invites.addMorePlaceholder")
                }
                placeholderTextColor={c.textMuted}
                value={text}
                onChangeText={handleTextChange}
                onSubmitEditing={handleSubmitEditing}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {t("invites.emailsReady", { count: allEmails.length })}
              </Text>
              <Text style={styles.metaMuted}>{t("invites.maxPerSend")}</Text>
            </View>

            {!!err && (
              <Banner tone="danger" title={t("common.error")} description={err} />
            )}

            <Button
              label={
                allEmails.length > 0
                  ? t("invites.sendInvites", { count: allEmails.length })
                  : t("invites.sendInvites", { count: 0 })
              }
              onPress={sendInvites}
              disabled={loading || allEmails.length === 0}
              loading={loading}
              size="lg"
            />
          </View>
        ) : null}
      </View>

      {/* Segmented tracker */}
      <View style={styles.trackerSection}>
        <Text style={styles.historyTitle}>{t("invites.pastInvitations")}</Text>

        <View style={styles.trackerSegment}>
          {(["all", "pending", "joined"] as const).map((tk) => {
            const active = tab === tk;
            const count =
              tk === "all" ? stats.total : tk === "pending" ? stats.pending : stats.joined;
            return (
              <Pressable
                key={tk}
                onPress={() => setTab(tk)}
                style={[
                  styles.trackerSegBtn,
                  active && { backgroundColor: c.surfaceElevated },
                ]}
              >
                <Text
                  style={[
                    styles.trackerSegText,
                    { color: active ? c.brandNavy : c.textMuted },
                  ]}
                >
                  {tk === "all"
                    ? t("invites.trackerAll", { defaultValue: "All" })
                    : tk === "pending"
                      ? t("invites.trackerPending", { defaultValue: "Pending" })
                      : t("invites.trackerJoined", { defaultValue: "Joined" })}
                  {"  "}
                  <Text style={styles.trackerSegCount}>{count}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loadingHistory ? (
          <View style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="100%" height={56} radius={radii.sm} />
            ))}
          </View>
        ) : filteredReferrals.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="mail-outline" size={28} color={c.textMuted} />
            <Text style={styles.emptyHistoryText}>
              {tab === "joined"
                ? t("invites.noJoinedYet", {
                    defaultValue: "Nobody has joined yet — keep sharing!",
                  })
                : t("invites.noInvitationsYet")}
            </Text>
          </View>
        ) : (
          filteredReferrals.map((ref, i) => (
            <ReferralRowView
              key={ref._id ?? `${ref.email ?? "row"}-${i}`}
              row={ref}
              t={t}
              c={c}
              styles={styles}
            />
          ))
        )}

        {isRefetching ? (
          <Text style={{ color: c.textMuted, ...typography.caption }}>
            {t("invites.refreshing", { defaultValue: "Refreshing..." })}
          </Text>
        ) : null}
      </View>
    </KeyboardAwareScrollScreen>
  );
}

function ReferralRowView({
  row,
  t,
  c,
  styles,
}: {
  row: ReferralRow;
  t: (k: string, opts?: any) => string;
  c: ReturnType<typeof useThemeColors>;
  styles: ReturnType<typeof useInviteStyles>;
}) {
  const joined = !!row.joined;
  const subtitle = joined
    ? t("invites.statusJoined", {
        defaultValue: "Joined {{date}}",
        date: row.joinedAt
          ? new Date(row.joinedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "",
      })
    : t("invites.statusPending", {
        defaultValue: "Invited {{date}}",
        date: row.createdAt
          ? new Date(row.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "",
      });
  return (
    <View style={styles.historyRow}>
      <View
        style={[
          styles.historyIcon,
          {
            backgroundColor: joined ? c.successSubtle ?? c.brandSubtle : c.brandSubtle,
          },
        ]}
      >
        <Ionicons
          name={joined ? "checkmark-circle-outline" : "mail-outline"}
          size={18}
          color={joined ? c.success : c.iconPrimary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.historyEmail} numberOfLines={1}>
          {row.email ?? ""}
        </Text>
        <Text style={styles.historyDate}>{subtitle}</Text>
        {row.targetAccountType ? (
          <Text style={styles.historyMeta}>
            {t("invites.invitedAs", {
              defaultValue: "Invited as {{role}}",
              role: row.targetAccountType,
            })}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.statusPill,
          {
            backgroundColor: joined ? c.successSubtle ?? c.brandSubtle : c.surfaceMuted,
          },
        ]}
      >
        <Text
          style={[
            styles.statusPillText,
            { color: joined ? c.success : c.textMuted },
          ]}
        >
          {joined
            ? t("invites.pillJoined", { defaultValue: "Joined" })
            : t("invites.pillPending", { defaultValue: "Pending" })}
        </Text>
      </View>
    </View>
  );
}

function TargetChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={[
        {
          flex: 1,
          paddingVertical: 10,
          borderRadius: radii.md,
          borderWidth: 1,
          alignItems: "center",
        },
        selected
          ? { backgroundColor: c.brandSubtle, borderColor: c.brandNavy }
          : { backgroundColor: c.surfaceMuted, borderColor: c.borderSubtle },
      ]}
    >
      <Text style={{ ...typography.bodySm, fontWeight: "700", color: c.text }}>{label}</Text>
    </Pressable>
  );
}

function StatBlock({
  icon,
  label,
  value,
  highlight,
  compact,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: number | string;
  highlight?: boolean;
  compact?: boolean;
}) {
  const c = useThemeColors();
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: highlight ? c.success : c.brandSubtle,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={20} color={highlight ? c.brandTextOn : c.brandNavy} />
      </View>
      <Text
        style={{
          ...(compact ? typography.bodyMd : typography.titleLg),
          color: c.text,
          marginTop: 6,
          fontWeight: "800",
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={{ ...typography.caption, color: c.textMuted }}>{label}</Text>
    </View>
  );
}

function ShareAction({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void | Promise<void>;
  tint?: string;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={() => void onPress()}
      style={({ pressed }) => [
        {
          flex: 1,
          alignItems: "center",
          gap: 6,
          paddingVertical: 10,
        },
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: c.surfaceElevated,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={22} color={tint ?? c.brandNavy} />
      </View>
      <Text style={{ ...typography.caption, color: c.text, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function useInviteStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.background },
      content: { padding: space.md, gap: space.md },
      hero: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        padding: space.lg,
        alignItems: "center",
        gap: 10,
      },
      heroIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
      },
      heroTitle: { ...typography.titleMd, textAlign: "center", fontWeight: "800" },
      heroSub: { ...typography.bodySm, textAlign: "center", lineHeight: 20 },
      codePill: {
        ...typography.caption,
        fontWeight: "700",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radii.pill,
        overflow: "hidden",
      },
      targetRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
      rewardLine: { ...typography.caption, marginTop: 6 },
      statsCard: {
        flexDirection: "row",
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: palette.borderSubtle,
        paddingVertical: space.md,
      },
      statDivider: { width: 1, backgroundColor: palette.borderSubtle },
      card: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
        gap: space.sm,
      },
      cardTitle: { ...typography.titleSm, fontWeight: "700" },
      cardSub: { ...typography.caption, color: palette.textMuted },
      shareRow: {
        flexDirection: "row",
        gap: space.xs,
      },
      composerHeader: {
        flexDirection: "row",
        alignItems: "center",
      },
      label: { ...typography.label, color: palette.textSecondary, marginTop: space.sm },
      chipContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radii.sm,
        paddingHorizontal: 10,
        paddingVertical: 8,
        minHeight: 48,
        alignItems: "center",
        backgroundColor: palette.input,
      },
      chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: palette.brandSubtle,
        borderRadius: radii.pill,
        paddingHorizontal: 10,
        paddingVertical: 5,
        maxWidth: "90%",
      },
      chipText: {
        ...typography.bodySm,
        color: palette.iconPrimary,
        fontWeight: "600",
        flexShrink: 1,
      },
      chipInput: {
        flex: 1,
        minWidth: 120,
        fontSize: typography.bodyMd.fontSize,
        color: palette.text,
        paddingVertical: 4,
      },
      metaRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },
      meta: { ...typography.caption, color: palette.textMuted },
      metaMuted: { ...typography.caption, color: palette.textMuted },
      trackerSection: {
        backgroundColor: palette.surfaceElevated,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        padding: space.md,
        gap: space.sm,
      },
      historyTitle: { ...typography.subtitle, color: palette.text, marginBottom: 4 },
      trackerSegment: {
        flexDirection: "row",
        padding: 4,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        gap: 2,
      },
      trackerSegBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: radii.sm,
        alignItems: "center",
      },
      trackerSegText: { ...typography.caption, fontWeight: "700" },
      trackerSegCount: { fontWeight: "700", opacity: 0.7 },
      emptyHistory: { alignItems: "center", gap: 6, paddingVertical: space.md },
      emptyHistoryText: { ...typography.bodySm, color: palette.textMuted, textAlign: "center" },
      historyRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      historyIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
      },
      historyEmail: { ...typography.bodySm, color: palette.text, fontWeight: "600" },
      historyDate: { ...typography.caption, color: palette.textMuted, marginTop: 1 },
      historyMeta: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.pill,
      },
      statusPillText: { ...typography.caption, fontWeight: "700" },
    })
  );
}
