import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { EmptyState, MorphRefreshScrollSurface, Skeleton } from "../../../components/ui";
import {
  FLASHLIST_PERF_DEFAULTS,
} from "../../../lib/lists/flatListPerf";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { queryKeys } from "../../../lib/queryKeys";
import { flatListKeyExtractor } from "../../../lib/lists/trainerListUtils";
import { StackSwipeBackShell } from "../../../navigation/StackSwipeBackShell";
import { useFloatingTabBarBottomInset } from "../../../navigation/useFloatingTabBarBottomInset";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { useAuth } from "../../auth/context/AuthContext";
import {
  fetchArchivedConversations,
  unarchiveChatConversation,
} from "../api/chatActionsApi";
import { useChatRoomChrome } from "../hooks/useChatRoomChrome";
import { ChatRoomScreen } from "./ChatRoomScreen";

function partnerFromConversation(conv: any, myId: string) {
  const parts = conv?.participants ?? [];
  return parts.find((p: any) => String(p?._id ?? p) !== String(myId)) ?? parts[0];
}

export function ArchivedChatsScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const myId = String(user?._id ?? user?.id ?? "");
  const bottomPad = useFloatingTabBarBottomInset(space.md);
  const [activeChat, setActiveChat] = useState<{
    conversationId: string;
    partner: any;
    isGroup?: boolean;
  } | null>(null);
  useChatRoomChrome(!!activeChat);

  const q = useQuery({
    queryKey: queryKeys.chats.archived,
    queryFn: fetchArchivedConversations,
  });

  const styles = useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingVertical: 12,
        paddingHorizontal: space.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: palette.surfaceMuted,
        alignItems: "center",
        justifyContent: "center",
      },
      meta: { flex: 1, minWidth: 0 },
      name: { ...typography.bodyMd, fontWeight: "600", color: palette.text },
      preview: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      unarchiveBtn: { padding: 8 },
    })
  );

  const onUnarchive = useCallback(
    async (conversationId: string) => {
      try {
        await unarchiveChatConversation(conversationId);
        void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
        Alert.alert(t("chats.unarchivedTitle"), t("chats.unarchivedBody"));
      } catch (e: any) {
        Alert.alert(t("chats.unarchiveError"), e?.message ?? t("chats.unarchiveError"));
      }
    },
    [queryClient, t]
  );

  if (activeChat) {
    return (
      <ChatRoomScreen
        conversationId={activeChat.conversationId}
        partner={activeChat.partner}
        isGroup={!!activeChat.isGroup}
        onGoBack={() => {
          setActiveChat(null);
          void q.refetch();
        }}
      />
    );
  }

  return (
    <StackSwipeBackShell>
      <View style={{ flex: 1, backgroundColor: c.surface }}>
        <MorphRefreshScrollSurface
          onRefresh={() => void q.refetch()}
          externalRefreshing={q.isRefetching}
          tintColor={c.brandAccent}
        >
          {({ refreshControl, onScroll, scrollEventThrottle }) => (
        <FlashList
          data={q.data ?? []}
          keyExtractor={flatListKeyExtractor}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          {...FLASHLIST_PERF_DEFAULTS}
          ListEmptyComponent={
            q.isLoading ? (
              <Skeleton height={64} style={{ margin: space.md }} />
            ) : (
              <EmptyState
                icon="archive-outline"
                title={t("chats.archivedEmptyTitle")}
                description={t("chats.archivedEmptyBody")}
              />
            )
          }
          renderItem={({ item }) => {
            const partner = partnerFromConversation(item, myId);
            const name = partner?.fullname ?? partner?.fullName ?? t("chats.unknownUser");
            const pic = getS3ImageUrl(partner?.profile_picture);
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  setActiveChat({
                    conversationId: String(item._id),
                    partner,
                    isGroup: !!item?.isGroup,
                  })
                }
              >
                <View style={styles.avatar}>
                  {pic ? (
                    <Text> </Text>
                  ) : (
                    <Ionicons name="person" size={22} color={c.textMuted} />
                  )}
                </View>
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {item?.lastMessage?.content ?? ""}
                  </Text>
                </View>
                <Pressable
                  style={styles.unarchiveBtn}
                  onPress={() => void onUnarchive(String(item._id))}
                  accessibilityLabel={t("chats.unarchive")}
                >
                  <Ionicons name="arrow-undo-outline" size={22} color={c.brandNavy} />
                </Pressable>
              </Pressable>
            );
          }}
        />
          )}
        </MorphRefreshScrollSurface>
        {q.isFetching && !q.isLoading ? (
          <ActivityIndicator style={{ padding: space.md }} color={c.brandNavy} />
        ) : null}
      </View>
    </StackSwipeBackShell>
  );
}
