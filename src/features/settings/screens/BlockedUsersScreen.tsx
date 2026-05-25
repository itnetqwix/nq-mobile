/**
 * BlockedUsersScreen — review and unblock people you've previously blocked.
 *
 * Today blocking from a chat or friend row is one-way: there's no UI to see
 * who you've blocked, so an accidental tap is permanent unless you contact
 * support. This screen fixes that.
 *
 *   • Loads `/user/blocked-users` (paginated server-side; we render the page).
 *   • Lets the user unblock with a confirmation alert.
 *   • Invalidates chat + friend caches on success so DM rate-limits clear.
 */

import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Card,
  EmptyState,
  ScreenContainer,
  SectionHeader,
} from "../../../components/ui";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { queryKeys } from "../../../lib/queryKeys";
import { space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import {
  fetchBlockedUsers,
  unblockUserById,
  type BlockedUser,
} from "../api/privacyApi";

const BLOCKED_KEY = ["settings", "blockedUsers"] as const;

export function BlockedUsersScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const qc = useQueryClient();

  const styles = useThemedStyles((p) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
      },
      meta: { flex: 1, gap: 2 },
      unblockBtn: {
        paddingHorizontal: space.md,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: p.border,
        backgroundColor: p.surfaceElevated,
      },
      explainerCard: {
        flexDirection: "row",
        gap: space.sm,
        padding: space.md,
        marginBottom: space.md,
      },
    })
  );

  const q = useQuery({
    queryKey: BLOCKED_KEY,
    queryFn: fetchBlockedUsers,
    staleTime: 30_000,
  });

  const unblockMut = useMutation({
    mutationFn: (userId: string) => unblockUserById(userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: BLOCKED_KEY });
      void qc.invalidateQueries({ queryKey: queryKeys.friends.list });
      void qc.invalidateQueries({ queryKey: queryKeys.chats.conversations });
    },
  });

  const onUnblock = useCallback(
    (u: BlockedUser) => {
      const name = u.fullname ?? u.fullName ?? u.email ?? t("blockList.defaultName", { defaultValue: "this person" });
      Alert.alert(
        t("blockList.unblockConfirmTitle", { defaultValue: "Unblock {{name}}?", name }),
        t("blockList.unblockConfirmBody", {
          defaultValue:
            "They'll be able to message you and see your profile again. You can block them later if needed.",
        }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("blockList.unblockConfirm", { defaultValue: "Unblock" }),
            style: "destructive",
            onPress: () => {
              unblockMut.mutate(u._id, {
                onError: (e) =>
                  Alert.alert(
                    t("blockList.unblockErrorTitle", { defaultValue: "Couldn't unblock" }),
                    getApiErrorMessage(e, t("common.error"))
                  ),
              });
            },
          },
        ]
      );
    },
    [t, unblockMut]
  );

  const renderItem = useCallback(
    ({ item }: { item: BlockedUser }) => {
      const name = item.fullname ?? item.fullName ?? t("blockList.defaultName", { defaultValue: "Account" });
      const blockedAt = item.blocked_at
        ? new Date(item.blocked_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : null;
      return (
        <View style={styles.row}>
          <Avatar size="md" name={name} uri={getS3ImageUrl(item.profile_picture) ?? undefined} />
          <View style={styles.meta}>
            <Text style={[typography.subtitle, { color: c.text }]} numberOfLines={1}>
              {name}
            </Text>
            {blockedAt ? (
              <Text style={[typography.caption, { color: c.textMuted }]}>
                {t("blockList.blockedOn", { defaultValue: "Blocked on {{date}}", date: blockedAt })}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => onUnblock(item)}
            accessibilityRole="button"
            accessibilityLabel={t("blockList.unblockA11y", {
              defaultValue: "Unblock {{name}}",
              name,
            })}
            disabled={unblockMut.isPending}
            style={styles.unblockBtn}
          >
            <Text style={[typography.label, { color: c.text }]}>
              {unblockMut.isPending && unblockMut.variables === item._id
                ? t("common.loading")
                : t("blockList.unblock", { defaultValue: "Unblock" })}
            </Text>
          </Pressable>
        </View>
      );
    },
    [styles, c.text, c.textMuted, t, onUnblock, unblockMut]
  );

  return (
    <ScreenContainer padding="md" background={c.surface}>
      <SectionHeader label={t("blockList.title", { defaultValue: "Blocked accounts" })} />

      <Card variant="outlined" padding={0} style={styles.explainerCard}>
        <Ionicons name="shield-checkmark-outline" size={22} color={c.iconPrimary} />
        <Text style={[typography.bodySm, { color: c.textSecondary, flex: 1 }]}>
          {t("blockList.explainer", {
            defaultValue:
              "Blocked accounts can't message you, see your online status, or find your profile. Unblocking lifts those restrictions but does not restore deleted conversations.",
          })}
        </Text>
      </Card>

      {q.isLoading ? (
        <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
          <ActivityIndicator color={c.brandAccent} />
        </View>
      ) : q.isError ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t("blockList.errorTitle", { defaultValue: "Couldn't load your block list" })}
          description={getApiErrorMessage(q.error, t("common.error"))}
          actionLabel={t("common.retry", { defaultValue: "Retry" })}
          onAction={() => q.refetch()}
        />
      ) : (q.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon="happy-outline"
          title={t("blockList.emptyTitle", { defaultValue: "No one is blocked" })}
          description={t("blockList.emptyBody", {
            defaultValue:
              "If you ever need to block someone, open their profile or a chat and pick \"Block\".",
          })}
        />
      ) : (
        <Card variant="outlined" padding={0}>
          <FlatList
            data={q.data ?? []}
            keyExtractor={(u) => u._id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 64 }} />
            )}
            scrollEnabled={false}
          />
        </Card>
      )}
    </ScreenContainer>
  );
}
