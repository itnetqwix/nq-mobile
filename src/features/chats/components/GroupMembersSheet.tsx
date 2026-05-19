import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../../../components/ui";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import { fetchFriends } from "../../home/api/homeApi";
import {
  clearChatConversation,
  deleteGroup,
  exitGroup,
  fetchGroupMembers,
  inviteToGroup,
  removeGroupMember,
  updateGroup,
} from "../api/chatActionsApi";
import {
  getPresignedChatUploadUrl,
  uploadChatFileToS3,
} from "../lib/chatMediaUpload";

type Member = {
  _id: string;
  fullname?: string;
  profile_picture?: string;
  isAdmin?: boolean;
};

type Props = {
  visible: boolean;
  conversationId: string;
  groupName: string;
  currentUserId: string;
  onClose: () => void;
  onLeftGroup: () => void;
};

export function GroupMembersSheet({
  visible,
  conversationId,
  groupName,
  currentUserId,
  onClose,
  onLeftGroup,
}: Props) {
  const c = useThemeColors();
  const styles = useSheetStyles();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [selectedInvitees, setSelectedInvitees] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["groupMembers", conversationId, search],
    queryFn: () => fetchGroupMembers(conversationId, search),
    enabled: visible && !!conversationId,
  });

  const isAdmin = String(data?.groupAdmin ?? "") === String(currentUserId);
  const members: Member[] = data?.members ?? [];
  const groupDescription = data?.groupDescription ?? "";
  const groupAvatarUrl = getS3ImageUrl(data?.groupAvatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickGroupPhoto = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert("Admin only", "Only the group admin can change the group photo.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to set a group image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    setUploadingAvatar(true);
    try {
      const fileName = `group-${conversationId}-${Date.now()}.jpg`;
      const { uploadUrl, mediaUrl } = await getPresignedChatUploadUrl(fileName, "image/jpeg");
      await uploadChatFileToS3(uploadUrl, result.assets[0].uri, "image/jpeg");
      await updateGroup(conversationId, { groupAvatar: mediaUrl });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? e?.message ?? "Could not update photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }, [conversationId, isAdmin, refetch, queryClient]);

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: fetchFriends,
    enabled: visible && showInvite,
  });

  const memberIds = useMemo(
    () => new Set(members.map((m) => String(m._id))),
    [members]
  );

  const inviteCandidates = useMemo(() => {
    const items: { _id: string; fullname?: string; profile_picture?: string }[] = [];
    const seen = new Set<string>();
    for (const f of friends) {
      const receiver = f?.receiverId;
      const sender = f?.senderId;
      let other: any = null;
      if (receiver && typeof receiver === "object" && receiver._id) {
        other = String(receiver._id) !== currentUserId ? receiver : null;
      }
      if (!other && sender && typeof sender === "object" && sender._id) {
        other = String(sender._id) !== currentUserId ? sender : null;
      }
      if (!other?._id) continue;
      const id = String(other._id);
      if (seen.has(id) || memberIds.has(id)) continue;
      seen.add(id);
      items.push({
        _id: id,
        fullname: other.fullname ?? other.fullName ?? "Friend",
        profile_picture: other.profile_picture,
      });
    }
    if (!inviteSearch.trim()) return items;
    const q = inviteSearch.toLowerCase();
    return items.filter((x) => (x.fullname ?? "").toLowerCase().includes(q));
  }, [friends, currentUserId, memberIds, inviteSearch]);

  const runInvite = useCallback(async () => {
    if (selectedInvitees.size < 1) return;
    setInviting(true);
    try {
      await inviteToGroup(conversationId, Array.from(selectedInvitees));
      setShowInvite(false);
      setSelectedInvitees(new Set());
      setInviteSearch("");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      Alert.alert("Invites sent", "Friends will see the request in Group requests.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.error ?? e?.message ?? "Could not send invites.");
    } finally {
      setInviting(false);
    }
  }, [conversationId, selectedInvitees, refetch, queryClient]);

  const confirmRemove = (member: Member) => {
    Alert.alert(
      "Remove member",
      `Remove ${member.fullname ?? "this member"} from the group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeGroupMember(conversationId, member._id).then(() => refetch());
          },
        },
      ]
    );
  };

  const confirmExit = () => {
    Alert.alert("Exit group", `Leave "${groupName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Exit",
        style: "destructive",
        onPress: () => {
          void exitGroup(conversationId).then(() => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            onClose();
            onLeftGroup();
          });
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert("Delete group", `Delete "${groupName}" for everyone?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteGroup(conversationId).then(() => {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            onClose();
            onLeftGroup();
          });
        },
      },
    ]);
  };

  const confirmClear = () => {
    Alert.alert("Clear chat", "Remove all messages in this group?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          void clearChatConversation(conversationId).then(() => {
            queryClient.invalidateQueries({ queryKey: ["chatMessages", conversationId] });
          });
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {groupName}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        <Pressable style={styles.avatarBlock} onPress={pickGroupPhoto} disabled={uploadingAvatar}>
          {groupAvatarUrl ? (
            <Image source={{ uri: groupAvatarUrl }} style={styles.groupAvatar} />
          ) : (
            <View style={[styles.groupAvatar, styles.groupAvatarFb]}>
              <Ionicons name="people" size={28} color="#fff" />
            </View>
          )}
          {isAdmin ? (
            <View style={styles.avatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          ) : null}
        </Pressable>
        <Text style={styles.avatarHint}>
          {isAdmin ? "Tap photo to change group image" : groupName}
        </Text>

        {!!groupDescription && (
          <Text style={styles.description}>{groupDescription}</Text>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionChip} onPress={() => setShowInvite(true)}>
            <Ionicons name="person-add-outline" size={18} color={c.brandNavy} />
            <Text style={styles.actionChipText}>Add members</Text>
          </Pressable>
          <Pressable style={styles.actionChip} onPress={confirmClear}>
            <Ionicons name="trash-outline" size={18} color={c.textMuted} />
            <Text style={[styles.actionChipText, { color: c.textMuted }]}>Clear chat</Text>
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={c.brandNavy} />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
            ListEmptyComponent={<EmptyState title="No members" subtitle="Invite friends to join." />}
            renderItem={({ item }) => {
              const avatar = getS3ImageUrl(item.profile_picture);
              const canRemove =
                isAdmin && String(item._id) !== String(currentUserId);
              return (
                <View style={styles.memberRow}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFb]}>
                      <Text style={styles.avatarInitial}>
                        {(item.fullname ?? "?")[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {item.fullname ?? "Member"}
                      {String(item._id) === String(currentUserId) ? " (You)" : ""}
                    </Text>
                    {item.isAdmin ? (
                      <Text style={styles.memberSub}>Admin</Text>
                    ) : null}
                  </View>
                  {canRemove ? (
                    <Pressable onPress={() => confirmRemove(item)} hitSlop={8}>
                      <Ionicons name="remove-circle-outline" size={24} color={c.danger} />
                    </Pressable>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={styles.footerBtn} onPress={confirmExit}>
            <Text style={styles.footerBtnDanger}>Exit group</Text>
          </Pressable>
          {isAdmin ? (
            <Pressable style={styles.footerBtn} onPress={confirmDelete}>
              <Text style={styles.footerBtnDanger}>Delete group</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Modal visible={showInvite} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Pressable onPress={() => setShowInvite(false)} hitSlop={12}>
              <Ionicons name="arrow-back" size={26} color={c.text} />
            </Pressable>
            <Text style={styles.title}>Invite friends</Text>
            <Pressable onPress={runInvite} disabled={inviting || selectedInvitees.size < 1} hitSlop={12}>
              {inviting ? (
                <ActivityIndicator size="small" color={c.brandNavy} />
              ) : (
                <Text
                  style={[
                    styles.createLink,
                    selectedInvitees.size < 1 && { opacity: 0.4 },
                  ]}
                >
                  Send
                </Text>
              )}
            </Pressable>
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={c.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              placeholderTextColor={c.textMuted}
              value={inviteSearch}
              onChangeText={setInviteSearch}
            />
          </View>
          <FlatList
            data={inviteCandidates}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const selected = selectedInvitees.has(item._id);
              return (
                <Pressable
                  style={styles.memberRow}
                  onPress={() => {
                    setSelectedInvitees((prev) => {
                      const next = new Set(prev);
                      if (next.has(item._id)) next.delete(item._id);
                      else next.add(item._id);
                      return next;
                    });
                  }}
                >
                  <Text style={styles.memberName}>{item.fullname}</Text>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={selected ? c.brandNavy : c.textMuted}
                  />
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </Modal>
  );
}

function useSheetStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: palette.surfaceElevated },
      header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space.md,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      title: { ...typography.titleSm, color: palette.text, flex: 1, textAlign: "center" },
      avatarBlock: {
        alignSelf: "center",
        marginTop: space.md,
        position: "relative",
      },
      groupAvatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
      },
      groupAvatarFb: {
        backgroundColor: palette.brandNavy,
        alignItems: "center",
        justifyContent: "center",
      },
      avatarBadge: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: palette.brandNavy,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: palette.surfaceElevated,
      },
      avatarHint: {
        textAlign: "center",
        fontSize: 12,
        color: palette.textMuted,
        marginTop: 6,
        marginBottom: 4,
      },
      description: {
        ...typography.bodySm,
        color: palette.textMuted,
        paddingHorizontal: space.md,
        paddingTop: space.sm,
        textAlign: "center",
      },
      actionsRow: {
        flexDirection: "row",
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingTop: space.md,
      },
      actionChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
        borderWidth: 1,
        borderColor: palette.border,
      },
      actionChipText: { fontSize: 13, fontWeight: "600", color: palette.brandNavy },
      searchBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        margin: space.md,
        paddingHorizontal: space.sm,
        paddingVertical: 9,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
      },
      searchInput: { flex: 1, fontSize: 15, color: palette.text },
      memberRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: palette.border,
      },
      avatar: { width: 44, height: 44, borderRadius: 22 },
      avatarFb: {
        backgroundColor: palette.brandNavy,
        alignItems: "center",
        justifyContent: "center",
      },
      avatarInitial: { color: palette.brandTextOn, fontWeight: "700", fontSize: 18 },
      memberName: { ...typography.subtitle, color: palette.text },
      memberSub: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
      footer: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: space.md,
        gap: 8,
        backgroundColor: palette.surfaceElevated,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.border,
        paddingTop: 12,
      },
      footerBtn: { alignItems: "center", paddingVertical: 10 },
      footerBtnDanger: { color: palette.danger, fontWeight: "700", fontSize: 15 },
      createLink: { color: palette.brandNavy, fontWeight: "700", fontSize: 16 },
    })
  );
}
