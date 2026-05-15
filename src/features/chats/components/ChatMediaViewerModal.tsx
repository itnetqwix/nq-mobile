import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ChatMediaItem } from "../lib/chatMediaUtils";

type Props = {
  visible: boolean;
  items: ChatMediaItem[];
  initialIndex: number;
  onClose: () => void;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export function ChatMediaViewerModal({ visible, items, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMediaItem>>(null);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      const safe = Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1));
      setIndex(safe);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: safe, animated: false });
      });
    }
  }, [visible, initialIndex, items.length]);

  const goTo = useCallback(
    (next: number) => {
      if (items.length === 0) return;
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      setIndex(clamped);
      listRef.current?.scrollToIndex({ index: clamped, animated: true });
    },
    [items.length]
  );

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      if (i >= 0 && i < items.length) setIndex(i);
    },
    [items.length]
  );

  if (!visible || items.length === 0) return null;

  const current = items[index];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.counter}>
            {index + 1} / {items.length}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(initialIndex, items.length - 1)}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToOffset({
                offset: info.index * SCREEN_W,
                animated: false,
              });
            }, 100);
          }}
          renderItem={({ item }) => (
            <View style={styles.page}>
              {item.type === "video" ? (
                <Video
                  source={{ uri: item.uri }}
                  style={styles.media}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  shouldPlay={item.id === current?.id}
                />
              ) : (
                <Image source={{ uri: item.uri }} style={styles.media} resizeMode="contain" />
              )}
            </View>
          )}
        />

        {index > 0 ? (
          <Pressable
            style={[styles.navBtn, styles.navLeft]}
            onPress={() => goTo(index - 1)}
            accessibilityLabel="Previous"
          >
            <Ionicons name="chevron-back" size={32} color="#fff" />
          </Pressable>
        ) : null}

        {index < items.length - 1 ? (
          <Pressable
            style={[styles.navBtn, styles.navRight]}
            onPress={() => goTo(index + 1)}
            accessibilityLabel="Next"
          >
            <Ionicons name="chevron-forward" size={32} color="#fff" />
          </Pressable>
        ) : null}

        <View style={[styles.bottomHint, { paddingBottom: insets.bottom + 12 }]}>
          <Ionicons
            name={current?.type === "video" ? "videocam" : "image"}
            size={16}
            color="rgba(255,255,255,0.8)"
          />
          <Text style={styles.hintText}>
            Swipe or use arrows · {current?.type === "video" ? "Video" : "Photo"}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  counter: { color: "#fff", fontSize: 16, fontWeight: "600" },
  page: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: "center",
    justifyContent: "center",
  },
  media: { width: SCREEN_W, height: SCREEN_H * 0.72 },
  navBtn: {
    position: "absolute",
    top: "45%",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  navLeft: { left: 8 },
  navRight: { right: 8 },
  bottomHint: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  hintText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
});
