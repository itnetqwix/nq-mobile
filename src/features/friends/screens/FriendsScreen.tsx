import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { radii, space } from "../../../theme/tokens";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import {
  fetchFriends,
  fetchFriendRequests,
  postAcceptFriendRequest,
  postRejectFriendRequest,
} from "../../home/api/homeApi";

const NAVY = "#000080";

const TABS = [
  { key: "friends", label: "Friends" },
  { key: "requests", label: "Requests" },
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

function FriendCard({ friend }: { friend: any }) {
  const user = friend?.receiverId ?? friend?.senderId ?? friend;
  const name = user?.fullname || user?.fullName || "Friend";
  return (
    <View style={styles.row}>
      <Avatar uri={user?.profile_picture} name={name} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{name}</Text>
        {!!user?.email && <Text style={styles.rowSub}>{user.email}</Text>}
      </View>
      {user?.is_online && <View style={styles.onlineDot} />}
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
        <Pressable
          style={[styles.reqBtn, { backgroundColor: NAVY }]}
          onPress={() => onAccept(request._id)}
        >
          <Text style={styles.reqBtnText}>Accept</Text>
        </Pressable>
        <Pressable
          style={[styles.reqBtn, { backgroundColor: "#dc2626" }]}
          onPress={() => onReject(request._id)}
        >
          <Text style={styles.reqBtnText}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function FriendsScreen() {
  const [tab, setTab] = useState<Tab>("friends");
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
    enabled: tab === "requests",
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

  const isLoading = tab === "friends" ? loadingFriends : loadingReqs;
  const isRefetching = tab === "friends" ? refreshingFriends : refreshingReqs;
  const refetch = tab === "friends" ? refetchFriends : refetchReqs;
  const data = tab === "friends" ? friends : requests;

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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item?._id ?? String(i)}
          renderItem={({ item }) =>
            tab === "friends" ? (
              <FriendCard friend={item} />
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
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={NAVY} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={tab === "friends" ? "people-outline" : "person-add-outline"}
                size={48}
                color="#d1d5db"
              />
              <Text style={styles.emptyTitle}>
                {tab === "friends" ? "No friends yet" : "No pending requests"}
              </Text>
              <Text style={styles.emptyBody}>
                {tab === "friends"
                  ? "Connect with trainers and trainees to build your network."
                  : "Friend requests you receive will appear here."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f7fb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: NAVY },
  tabText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: NAVY },
  badge: { fontSize: 12, color: "#dc2626", fontWeight: "700" },

  list: { padding: space.md, gap: space.sm, paddingBottom: space.xl },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  rowSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#16a34a" },

  reqActions: { flexDirection: "column", gap: 6 },
  reqBtn: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" },
  reqBtnText: { fontSize: 12, color: "#fff", fontWeight: "600" },

  avatarFallback: { backgroundColor: NAVY, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#fff", fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: space.xl * 2, gap: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, paddingHorizontal: space.lg },
});
