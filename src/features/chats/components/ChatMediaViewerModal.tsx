import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeMediaSurface } from "../../../components/media/NativeMediaSurface";
import { useMediaViewport } from "../../../components/media/useMediaViewport";
import type { ChatMediaItem } from "../lib/chatMediaUtils";

type Props = {
  visible: boolean;
  items: ChatMediaItem[];
  initialIndex: number;
  onClose: () => void;
};

const HEADER_BLOCK = 52;

export function ChatMediaViewerModal({ visible, items, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMediaItem>>(null);
  const [index, setIndex] = useState(initialIndex);
  const { width: pageWidth, height: mediaHeight } = useMediaViewport({
    headerHeight: HEADER_BLOCK + insets.top,
    footerHeight: 40 + insets.bottom,
  });

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
      const i = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      if (i >= 0 && i < items.length) setIndex(i);
    },
    [items.length, pageWidth]
  );

  if (!visible || items.length === 0) return null;

  const current = items[index];

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.counter}>
            {index + 1} / {items.length}
          </Text>
          <View style={styles.topSpacer} />
        </View>

        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(initialIndex, items.length - 1)}
          getItemLayout={(_, i) => ({
            length: pageWidth,
            offset: pageWidth * i,
            index: i,
          })}
          onMomentumScrollEnd={onMomentumEnd}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToOffset({
                offset: info.index * pageWidth,
                animated: false,
              });
            }, 100);
          }}
          renderItem={({ item, index: itemIndex }) => {
            const isActive = itemIndex === index;
            return (
              <View style={[styles.page, { width: pageWidth }]}>
                <MediaPage
                  item={item}
                  width={pageWidth}
                  height={mediaHeight}
                  isActive={isActive && visible}
                />
              </View>
            );
          }}
        />

        {index > 0 ? (
          <Pressable
            style={[styles.navBtn, styles.navLeft, { top: insets.top + mediaHeight * 0.4 }]}
            onPress={() => goTo(index - 1)}
            accessibilityLabel="Previous"
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
        ) : null}

        {index < items.length - 1 ? (
          <Pressable
            style={[styles.navBtn, styles.navRight, { top: insets.top + mediaHeight * 0.4 }]}
            onPress={() => goTo(index + 1)}
            accessibilityLabel="Next"
          >
            <Ionicons name="chevron-forward" size={28} color="#fff" />
          </Pressable>
        ) : null}

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <Ionicons
            name={current?.type === "video" ? "videocam" : "image"}
            size={16}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.hintText}>
            Swipe for more · {current?.type === "video" ? "Video" : "Photo"}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function MediaPage({
  item,
  width,
  height,
  isActive,
}: {
  item: ChatMediaItem;
  width: number;
  height: number;
  isActive: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  if (failed) {
    return (
      <View style={[styles.failBox, { width, height }]}>
        <Ionicons name="image-outline" size={40} color="#6b7280" />
        <Text style={styles.failText}>Could not load media</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <NativeMediaSurface
        uri={item.uri}
        mode={item.type === "video" ? "video" : "image"}
        width={width}
        height={height}
        isActive={isActive}
        onReady={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading ? (
        <View style={styles.pageLoading} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  counter: { color: "#fff", fontSize: 16, fontWeight: "600" },
  topSpacer: { width: 28 },
  page: {
    alignItems: "center",
    justifyContent: "center",
  },
  pageLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  failBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111",
  },
  failText: { color: "#9ca3af", fontSize: 14 },
  navBtn: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
  },
  navLeft: { left: 10 },
  navRight: { right: 10 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  hintText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
});
