import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Button, EmptyState, Skeleton } from "../../../components/ui";
import { colors, radii, space, typography } from "../../../theme";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import {
  fetchFriends,
  fetchFriendRequests,
  fetchSentFriendRequests,
  postAcceptFriendRequest,
  postRejectFriendRequest,
} from "../../home/api/homeApi";

import { ShareClipsPanel } from "../components/ShareClipsPanel";
import { ChatRoomScreen } from "../../chats/screens/ChatRoomScreen";

const TABS = [
  { key: "friends", label: "Friends" },
  { key: "requests", label: "Requests" },
  { key: "sent", label: "Sent" },
  { key: "share", label: "Share clips" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function Avatar({ uri, name, size = 48 }: { uri?: string; name?: string; size?: number }) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(uri);
  if (!url || failed) {
    return (
      <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>
          {(name ?? "?")[0]?.toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setFailed(true)}
    />
  );
}

function FriendCard({
  friend,
  onMessage,
  messageBusy,
}: {
  friend: any;
  onMessage: (userId: string, name: string, picture?: string) => void;
  messageBusy: boolean;
}) {
  const user = friend?.receiverId ?? friend?.senderId ?? friend;
  const name = user?.fullname || user?.fullName || "Friend";
  return (
    <View style={styles.row}>
      <Avatar uri={user?.profile_picture} name={name} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{name}</Text>
        {!!user?.email && <Text style={styles.rowSub}>{user.email}</Text>}
      </View>
      <View style={styles.friendActions}>
        {user?.is_online && <View style={styles.onlineDot} />}
        <Pressable
          style={styles.msgBtn}
          onPress={() => onMessage(String(user._id), name, user?.profile_picture)}
          disabled={messageBusy}
        >
          {messageBusy ? (
            <ActivityIndicator size={14} color={colors.brandTextOn} />
          ) : (
            <Ionicons name="chatbubble-outline" size={14} color={colors.brandTextOn} />
          )}
          <Text style={styles.msgBtnText}>Message</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RequestCard({
  request,
  onAccept,
  onReject,
}: {
  request: any;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const sender = request?.senderId;
  const name = sender?.fullname || sender?.fullName || "User";
  return (
    <View style={styles.row}>
      <Avatar uri={sender?.profile_picture} name={name} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowSub}>Sent you a friend request</Text>
      </View>
      <View style={styles.reqActions}>
        <Button
          label="Accept"
          size="sm"
          fullWidth={false}
          onPress={() => onAccept(request._id)}
        />
        <Button
          label="Reject"
          size="sm"
          variant="danger"
          fullWidth={false}
          onPress={() => onReject(request._id)}
        />
      </View>
    </View>
  );
}

function SentRequestCard({
  request,
  onCancel,
  cancelBusy,
}: {
  request: any;
  onCancel: (receiverId: string) => void;
  cancelBusy: boolean;
}) {
  const receiver = request?.receiverId;
  const name = receiver?.fullname || receiver?.fullName || "User";
  const status: string = request?.status ?? "pending";
  const isPending = status === "pending";

  return (
    <View style={styles.row}>
      <Avatar uri={receiver?.profile_picture} name={name} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{name}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, isPending ? styles.statusPending : styles.statusAccepted]} />
          <Text style={[styles.rowSub, { marginTop: 0 }]}>
            {isPending ? "Pending" : "Accepted"}
          </Text>
        </View>
      </View>
      {isPending && (
        <Button
          label="Cancel"
          size="sm"
          variant="danger"
          fullWidth={false}
          onPress={() => onCancel(String(receiver?._id))}
          disabled={cancelBusy}
        />
      )}
    </View>
  );
}

export function FriendsScreen() {
  const [tab, setTab] = useState<Tab>("friends");
  const [messageBusy, setMessageBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [activeChat, setActiveChat] = useState<{
    conversationId: string;
    partner: { _id: string; fullname?: string; profile_picture?: string };
  } | null>(null);
  const queryClient = useQueryClient();

  const { data: friends = [], isLoading: loadingFriends, isRefetching: refreshingFriends, refetch: refetchFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriends,
    staleTime: 120_000,
    enabled: tab === "friends",
  });

  const { data: requests = [], isLoading: loadingReqs, isRefetching: refreshingReqs, refetch: refetchReqs } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: fetchFriendRequests,
    staleTime: 60_000,
  });

  const { data: sentRequests = [], isLoading: loadingSent, isRefetching: refreshingSent, refetch: refetchSent } = useQuery({
    queryKey: ["sentFriendRequests"],
    queryFn: fetchSentFriendRequests,
    staleTime: 60_000,
    enabled: tab === "sent",
  });

  const handleAccept = async (requestId: string) => {
    await postAcceptFriendRequest(requestId);
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    queryClient.invalidateQueries({ queryKey: ["friends"] });
  };

  const handleReject = async (requestId: string) => {
    await postRejectFriendRequest(requestId);
    queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
  };

  const handleCancelRequest = async (receiverId: string) => {
    setCancelBusy(true);
    try {
      await apiClient.post(API_ROUTES.user.cancelFriendRequest, { receiverId });
      queryClient.invalidateQueries({ queryKey: ["sentFriendRequests"] });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? "Could not cancel request.");
    } finally {
      setCancelBusy(false);
    }
  };

  const handleMessage = useCallback(
    async (userId: string, name: string, picture?: string) => {
      setMessageBusy(true);
      try {
        const res = await apiClient.post(API_ROUTES.chat.conversation, {
          otherUserId: userId,
          participantId: userId,
        });
        const body = (res as any)?.data ?? res;
        const conversation = body?.data ?? body?.result ?? body;
        const convId = conversation?._id ?? conversation?.conversationId;
        if (convId) {
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          setActiveChat({
            conversationId: convId,
            partner: { _id: userId, fullname: name, profile_picture: picture },
          });
        } else {
          Alert.alert("Error", "Could not open chat — no conversation returned.");
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ??
          e?.response?.data?.error ??
          e?.message ??
          "Could not open chat.";
        Alert.alert("Error", String(msg));
      } finally {
        setMessageBusy(false);
      }
    },
    [queryClient]
  );

  const isLoading =
    tab === "friends" ? loadingFriends :
    tab === "requests" ? loadingReqs :
    tab === "sent" ? loadingSent : false;
  const isRefetching =
    tab === "friends" ? refreshingFriends :
    tab === "requests" ? refreshingReqs :
    tab === "sent" ? refreshingSent : false;
  const refetch =
    tab === "friends" ? refetchFriends :
    tab === "requests" ? refetchReqs :
    tab === "sent" ? refetchSent : () => {};
  const data =
    tab === "friends" ? friends :
    tab === "requests" ? requests :
    tab === "sent" ? sentRequests : [];

  if (activeChat) {
    return (
      <ChatRoomScreen
        conversationId={activeChat.conversationId}
        partner={activeChat.partner}
        onGoBack={() => {
          setActiveChat(null);
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
              {t.key === "requests" && requests.length > 0 && (
                <Text style={styles.badge}> {requests.length}</Text>
              )}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: space.md }}>
              <Skeleton width="100%" height={68} radius={radii.md} />
            </View>
          ))}
        </View>
      ) : tab === "share" ? (
        <ShareClipsPanel />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item?._id ?? String(i)}
          renderItem={({ item }) =>
            tab === "friends" ? (
              <FriendCard
                friend={item}
                onMessage={handleMessage}
                messageBusy={messageBusy}
              />
            ) : tab === "sent" ? (
              <SentRequestCard
                request={item}
                onCancel={handleCancelRequest}
                cancelBusy={cancelBusy}
              />
            ) : (
              <RequestCard
                request={item}
                onAccept={handleAccept}
                onReject={handleReject}
              />
            )
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandNavy} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={
                tab === "friends" ? "people-outline" :
                tab === "sent" ? "paper-plane-outline" :
                "person-add-outline"
              }
              title={
                tab === "friends" ? "No friends yet" :
                tab === "sent" ? "No sent requests" :
                "No pending requests"
              }
              description={
                tab === "friends"
                  ? "Connect with trainers and trainees to build your network."
                  : tab === "sent"
                  ? "Friend requests you send will appear here with their status."
                  : "Friend requests you receive will appear here."
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: colors.brandNavy },
  tabText: { ...typography.label, color: colors.textMuted, fontSize: 12 },
  tabTextActive: { color: colors.brandNavy },
  badge: { fontSize: 12, color: colors.danger, fontWeight: "700" },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowInfo: { flex: 1 },
  rowName: { ...typography.subtitle, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },

  reqActions: { flexDirection: "column", gap: 6 },
  friendActions: { alignItems: "flex-end", gap: 6 },
  msgBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  msgBtnText: { fontSize: 12, fontWeight: "700", color: colors.brandTextOn },

  avatarFallback: { backgroundColor: colors.brandNavy, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brandTextOn, fontWeight: "700" },

  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPending: { backgroundColor: "#f59e0b" },
  statusAccepted: { backgroundColor: colors.success },
});
