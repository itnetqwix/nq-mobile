import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../../components/ui";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { space, typography, useThemeColors } from "../../../theme";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { peekPendingAuthIntent } from "../lib/pendingAuthIntent";
import { getTrainerName } from "../../bookexpert/lib/trainerUtils";
import type { AuthIntent } from "../types/authIntent";

type Flavor = "schedule" | "chats" | "generic";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  bodyKey: string;
  /** Which mock preview to show in the background. Defaults to "generic". */
  flavor?: Flavor;
};

/**
 * Lock screen shown when a guest taps a gated tab (Schedule / Chats).
 *
 * We render a *real* mock of the feature behind a dimmed overlay so the user
 * can see exactly what they're about to unlock. If a recent intent was set
 * with a `trainer` (e.g. they tapped "Chat" on Coach X's card before being
 * pushed here), we surface that coach's avatar + name in the CTA — "Sign in
 * to chat with Coach X" — rather than the generic message.
 */
export function GuestTabGateScreen({ icon, titleKey, bodyKey, flavor = "generic" }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const { openAuth } = useRequireAuth();

  const pending = peekPendingAuthIntent();
  const trainer = pending?.trainer;
  const trainerName = trainer ? getTrainerName(trainer) : null;
  const trainerAvatar =
    (trainer?.profile_picture as string | undefined) ||
    (trainer?.avatar as string | undefined) ||
    null;

  const ctaTitle = useMemo(() => {
    if (trainerName) {
      if (flavor === "chats") return t("guest.lock.chatWithCoach", { name: trainerName });
      if (flavor === "schedule")
        return t("guest.lock.bookWithCoach", { name: trainerName });
    }
    return t(titleKey);
  }, [flavor, trainerName, t, titleKey]);

  const ctaBody = useMemo(() => {
    if (trainerName && pending?.intent === "chat")
      return t("guest.lock.chatBody", { name: trainerName });
    if (trainerName && pending?.intent === "book")
      return t("guest.lock.bookBody", { name: trainerName });
    return t(bodyKey);
  }, [trainerName, pending?.intent, t, bodyKey]);

  const primaryScreen: "Login" | "SignUp" = "Login";

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View pointerEvents="none" style={styles.mockLayer}>
        {flavor === "chats" ? (
          <ChatsMock palette={c} />
        ) : flavor === "schedule" ? (
          <ScheduleMock palette={c} />
        ) : (
          <GenericMock icon={icon} palette={c} />
        )}
      </View>

      <View
        pointerEvents="none"
        style={[styles.scrim, { backgroundColor: c.background }]}
      />

      <View style={styles.cardWrap}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surfaceElevated,
              borderColor: c.borderSubtle,
              shadowColor: c.brandNavy,
            },
          ]}
        >
          {trainerAvatar || trainerName ? (
            <View style={styles.coachRow}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: c.brandAccentSubtle, borderColor: c.brandAccent },
                ]}
              >
                {trainerAvatar ? (
                  <Image
                    source={{ uri: trainerAvatar }}
                    style={styles.avatarImg}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={[styles.avatarLetter, { color: c.brandAccent }]}>
                    {(trainerName ?? "C").slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.coachMeta}>
                <Text style={[typography.titleSm, { color: c.text }]} numberOfLines={1}>
                  {trainerName}
                </Text>
                <Text style={[styles.coachHint, { color: c.textMuted }]}>
                  {flavor === "chats"
                    ? t("guest.lock.coachWaiting")
                    : t("guest.lock.coachAvailable")}
                </Text>
              </View>
              <View style={[styles.lockBadge, { backgroundColor: c.brandAccent }]}>
                <Ionicons name="lock-closed" size={14} color="#fff" />
              </View>
            </View>
          ) : (
            <View
              style={[styles.iconWrap, { backgroundColor: c.brandAccentSubtle }]}
            >
              <Ionicons name={icon} size={32} color={c.brandAccent} />
            </View>
          )}

          <Text style={[typography.titleMd, styles.title, { color: c.text }]}>
            {ctaTitle}
          </Text>
          <Text style={[styles.body, { color: c.textMuted }]}>{ctaBody}</Text>

          <Button
            label={t("auth.signIn")}
            size="lg"
            onPress={() => openAuth(primaryScreen, ctxFor(flavor, pending?.intent))}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}

function ctxFor(flavor: Flavor, currentIntent?: AuthIntent | undefined) {
  if (currentIntent) return { intent: currentIntent };
  if (flavor === "chats") return { intent: "chat" as const };
  if (flavor === "schedule") return { intent: "schedule" as const };
  return undefined;
}

/* -------------------------- mocks ------------------------------------ */

function ChatsMock({ palette }: { palette: ReturnType<typeof useThemeColors> }) {
  const rows = [
    { name: "Coach Asha", text: "See you at 6 — bring a towel!", time: "1m" },
    { name: "Coach Marco", text: "Loved your form on those squats", time: "12m" },
    { name: "Group: Run Club", text: "Mei: pace was 🔥 today", time: "1h" },
    { name: "Coach Priya", text: "Workout plan attached", time: "3h" },
    { name: "Coach Liam", text: "How's recovery going?", time: "Yesterday" },
  ];
  return (
    <View style={mockStyles.list}>
      {rows.map((r, i) => (
        <View
          key={i}
          style={[
            mockStyles.row,
            { borderBottomColor: palette.borderSubtle },
          ]}
        >
          <View style={[mockStyles.avatar, { backgroundColor: palette.brandAccentSubtle }]} />
          <View style={mockStyles.rowBody}>
            <Text
              style={[mockStyles.rowName, { color: palette.text }]}
              numberOfLines={1}
            >
              {r.name}
            </Text>
            <Text
              style={[mockStyles.rowText, { color: palette.textMuted }]}
              numberOfLines={1}
            >
              {r.text}
            </Text>
          </View>
          <Text style={[mockStyles.rowTime, { color: palette.textMuted }]}>{r.time}</Text>
        </View>
      ))}
    </View>
  );
}

function ScheduleMock({ palette }: { palette: ReturnType<typeof useThemeColors> }) {
  const cards = [
    { day: "Mon", date: "27", title: "HIIT with Coach Asha", time: "6:00 PM" },
    { day: "Wed", date: "29", title: "Strength with Coach Marco", time: "7:30 AM" },
    { day: "Sat", date: "01", title: "Group Run Club", time: "8:00 AM" },
  ];
  return (
    <View style={mockStyles.cardList}>
      {cards.map((c, i) => (
        <View
          key={i}
          style={[
            mockStyles.sessionCard,
            { backgroundColor: palette.surfaceElevated, borderColor: palette.borderSubtle },
          ]}
        >
          <View
            style={[
              mockStyles.dayChip,
              { backgroundColor: palette.brandAccentSubtle },
            ]}
          >
            <Text style={[mockStyles.dayLabel, { color: palette.brandAccent }]}>
              {c.day}
            </Text>
            <Text style={[mockStyles.dayDate, { color: palette.brandAccent }]}>
              {c.date}
            </Text>
          </View>
          <View style={mockStyles.sessionBody}>
            <Text style={[mockStyles.sessionTitle, { color: palette.text }]} numberOfLines={1}>
              {c.title}
            </Text>
            <Text style={[mockStyles.sessionTime, { color: palette.textMuted }]}>
              {c.time}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function GenericMock({
  icon,
  palette,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  palette: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={mockStyles.generic}>
      <Ionicons name={icon} size={120} color={palette.brandAccentSubtle} />
    </View>
  );
}

const mockStyles = StyleSheet.create({
  list: { paddingTop: space.md, paddingHorizontal: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontWeight: "700", fontSize: 15 },
  rowText: { fontSize: 13 },
  rowTime: { fontSize: 11 },
  cardList: { paddingTop: space.md, paddingHorizontal: space.md, gap: space.sm },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: space.sm,
    gap: space.md,
  },
  dayChip: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 54,
  },
  dayLabel: { fontWeight: "700", fontSize: 11, letterSpacing: 1 },
  dayDate: { fontWeight: "800", fontSize: 18 },
  sessionBody: { flex: 1 },
  sessionTitle: { fontWeight: "700", fontSize: 15 },
  sessionTime: { fontSize: 12, marginTop: 2 },
  generic: { flex: 1, alignItems: "center", justifyContent: "center" },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  mockLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.62,
  },
  cardWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: space.lg,
    gap: space.sm,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: space.xs,
  },
  coachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginBottom: space.xs,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarLetter: { fontWeight: "800", fontSize: 22 },
  coachMeta: { flex: 1 },
  coachHint: { fontSize: 12, marginTop: 2 },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { textAlign: "left" },
  body: {
    ...typography.bodyMd,
    textAlign: "left",
    lineHeight: 22,
    marginBottom: space.md,
  },
  linkBtn: { alignSelf: "center", marginTop: space.xs, paddingVertical: 8 },
  linkText: { fontWeight: "700", fontSize: 14 },
});
