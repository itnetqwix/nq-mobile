import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
import {
  MediaLoadingOverlay,
  MediaViewerChrome,
  NativeMediaSurface,
} from "../../../components/media";
import { useMediaViewport } from "../../../components/media/useMediaViewport";
import { colorsDark, typography, useThemedStyles } from "../../../theme";
import type { ChatMediaItem } from "../lib/chatMediaUtils";

type Props = {
  visible: boolean;
  items: ChatMediaItem[];
  initialIndex: number;
  onClose: () => void;
};

const HEADER_BLOCK = 56;

/** Immersive fullscreen viewer — always uses dark chrome regardless of app theme. */
function useMediaViewerStyles() {
  return useThemedStyles(() =>
    StyleSheet.create({
      root: { flex: 1, backgroundColor: colorsDark.overlayVideo },
      page: { alignItems: "center", justifyContent: "center" },
      failBox: {
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: colorsDark.surface,
      },
      failText: { ...typography.bodySm, color: colorsDark.textMuted },
      navBtn: {
        position: "absolute",
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "rgba(0,0,128,0.65)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
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
        backgroundColor: colorsDark.overlay,
      },
      hintText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
    })
  );
}

export function ChatMediaViewerModal({ visible, items, initialIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useMediaViewerStyles();
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
        <MediaViewerChrome
          title={`${index + 1} of ${items.length}`}
          subtitle={current?.type === "video" ? "Video" : "Photo"}
          onClose={onClose}
          style={{ paddingTop: insets.top + 4 }}
        />

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
                  styles={styles}
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
            <Ionicons name="chevron-back" size={28} color={colorsDark.brandTextOn} />
          </Pressable>
        ) : null}

        {index < items.length - 1 ? (
          <Pressable
            style={[styles.navBtn, styles.navRight, { top: insets.top + mediaHeight * 0.4 }]}
            onPress={() => goTo(index + 1)}
            accessibilityLabel="Next"
          >
            <Ionicons name="chevron-forward" size={28} color={colorsDark.brandTextOn} />
          </Pressable>
        ) : null}

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <Ionicons
            name={current?.type === "video" ? "videocam" : "image"}
            size={16}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.hintText}>Swipe for more</Text>
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
  styles,
}: {
  item: ChatMediaItem;
  width: number;
  height: number;
  isActive: boolean;
  styles: ReturnType<typeof useMediaViewerStyles>;
}) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFailed(false);
    setLoading(true);
  }, [item.uri, item.type]);

  if (failed) {
    return (
      <View style={[styles.failBox, { width, height }]}>
        <Ionicons name="image-outline" size={40} color={colorsDark.textMuted} />
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
        loadingMode="parent"
        onLoadingChange={setLoading}
        useNativeVideoControls={false}
        showCustomControls={item.type === "video"}
        onReady={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading ? <MediaLoadingOverlay message="Loading" /> : null}
    </View>
  );
}
