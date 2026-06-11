import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  getCapturedClips,
  deleteCapturedClip,
  type CapturedClip,
} from "./CaptureScreen";
import { colors, radii, space, typography } from "../../../theme";

export function CapturedLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [clips, setClips] = useState<CapturedClip[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = await getCapturedClips();
    setClips(c);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    Alert.alert(
      "Delete Clips",
      `Delete ${selected.size} clip${selected.size === 1 ? "" : "s"}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            for (const id of selected) {
              await deleteCapturedClip(id);
            }
            setSelected(new Set());
            setSelectMode(false);
            void load();
          },
        },
      ]
    );
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return "";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const renderItem = ({ item }: { item: CapturedClip }) => {
    const isSelected = selected.has(item.id);
    const isPlaying = playingId === item.id;
    return (
      <Pressable
        style={styles.clipCard}
        onPress={() => {
          if (selectMode) {
            toggleSelect(item.id);
            return;
          }
          setPlayingId(isPlaying ? null : item.id);
        }}
        onLongPress={() => {
          if (!selectMode) setSelectMode(true);
          toggleSelect(item.id);
        }}
      >
        {selectMode && (
          <View style={[styles.check, isSelected && styles.checkOn]}>
            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        )}

        <View style={styles.thumbWrap}>
          {isPlaying ? (
            <Video
              source={{ uri: item.uri }}
              style={styles.thumb}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping={false}
              useNativeControls
            />
          ) : (
            <View style={styles.thumbPh}>
              <Ionicons name="play-circle" size={32} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.meta}>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {item.durationSecs ? (
            <Text style={styles.dur}>{formatDuration(item.durationSecs)}</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              navigation.navigate("ClipUpload", { capturedUri: item.uri });
            }}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={colors.brandNavy} />
            <Text style={styles.actionText}>Upload</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.deleteActionBtn]}
            onPress={(e) => {
              e.stopPropagation?.();
              Alert.alert("Delete", "Delete this clip?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    await deleteCapturedClip(item.id);
                    void load();
                  },
                },
              ]);
            }}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.brandNavy} />
        </Pressable>
        <Text style={styles.title}>Captured Library</Text>
        {selectMode ? (
          <Pressable style={styles.headerAction} onPress={() => {
            setSelectMode(false);
            setSelected(new Set());
          }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.headerAction}
            onPress={() => setSelectMode(true)}
            disabled={clips.length === 0}
          >
            <Ionicons name="checkbox-outline" size={22} color={colors.brandNavy} />
          </Pressable>
        )}
      </View>

      {selectMode && selected.size > 0 && (
        <View style={styles.selectBar}>
          <Text style={styles.selectBarText}>{selected.size} selected</Text>
          <Pressable style={styles.deleteBar} onPress={handleDeleteSelected}>
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.deleteBarText}>Delete</Text>
          </Pressable>
        </View>
      )}

      {clips.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="videocam-outline" size={48} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No captured clips yet</Text>
          <Text style={styles.emptySub}>
            Tap the Capture tab to record your first clip.
          </Text>
          <Pressable
            style={styles.captureBtn}
            onPress={() => navigation.navigate("Capture")}
          >
            <Ionicons name="videocam-outline" size={16} color="#fff" />
            <Text style={styles.captureBtnText}>Start Recording</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  backBtn: { padding: 4 },
  title: { flex: 1, ...typography.subtitle, marginLeft: space.sm },
  headerAction: { padding: 6 },
  cancelText: { color: colors.brandNavy, fontWeight: "600", fontSize: 15 },
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: "#f3f4f6",
  },
  selectBarText: { ...typography.bodySm, color: "#374151" },
  deleteBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  deleteBarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  list: { padding: space.md, gap: space.sm },
  clipCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: space.sm,
    backgroundColor: "#f9fafb",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: space.sm,
    marginBottom: space.sm,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkOn: { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy },
  thumbWrap: {
    width: 72,
    height: 56,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: "#1f2937",
    flexShrink: 0,
  },
  thumb: { width: "100%", height: "100%" },
  thumbPh: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  meta: { flex: 1 },
  date: { fontSize: 13, fontWeight: "600", color: "#111827" },
  dur: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brandNavy,
  },
  deleteActionBtn: { borderColor: "#fecaca", paddingHorizontal: 8 },
  actionText: { fontSize: 11, fontWeight: "700", color: colors.brandNavy },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  emptySub: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  captureBtn: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandNavy,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  captureBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
