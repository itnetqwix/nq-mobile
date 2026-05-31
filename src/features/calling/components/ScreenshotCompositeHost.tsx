import React, { useEffect, useState } from "react";
import { Image, View, type LayoutChangeEvent } from "react-native";

type Props = {
  frameUris: string[];
  captureRef: React.RefObject<View | null>;
  onLayout: (e: LayoutChangeEvent) => void;
  /** Called when all frame images have finished loading (for composite capture timing). */
  onFramesReady?: () => void;
};

/** Off-screen stack used to merge dual-clip thumbnails before upload. */
export function ScreenshotCompositeHost({
  frameUris,
  captureRef,
  onLayout,
  onFramesReady,
}: Props) {
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    setLoadedCount(0);
  }, [frameUris]);

  useEffect(() => {
    if (frameUris.length >= 2 && loadedCount >= frameUris.length) {
      onFramesReady?.();
    }
  }, [frameUris.length, loadedCount, onFramesReady]);

  if (frameUris.length < 2) return null;
  return (
    <View
      ref={captureRef}
      collapsable={false}
      onLayout={onLayout}
      style={{
        position: "absolute",
        left: -4000,
        top: 0,
        width: 360,
        backgroundColor: "#ffffff",
      }}
    >
      {frameUris.map((uri, i) => (
        <Image
          key={`${uri}-${i}`}
          source={{ uri }}
          style={{ width: 360, height: 240, backgroundColor: "#fff" }}
          resizeMode="contain"
          onLoadEnd={() => setLoadedCount((n) => n + 1)}
        />
      ))}
    </View>
  );
}
