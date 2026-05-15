import { Ionicons } from "@expo/vector-icons";
import * as VideoThumbnails from "expo-video-thumbnails";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "../../../theme";

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  isMine?: boolean;
};

export function ChatVideoThumbnail({ uri, style, onPress, isMine }: Props) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setThumbUri(null);
    (async () => {
      try {
        const { uri: generated } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 800,
          quality: 0.65,
        });
        if (!cancelled) setThumbUri(generated);
      } catch {
        if (!cancelled) setThumbUri(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <Pressable onPress={onPress} style={[styles.container, style]}>
      {thumbUri ? (
        <Image source={{ uri: thumbUri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={styles.fallback}>
          {loading ? (
            <ActivityIndicator color={isMine ? "#fff" : colors.brandNavy} />
          ) : (
            <Ionicons name="videocam" size={28} color={isMine ? "#fff" : colors.brandNavy} />
          )}
        </View>
      )}
      <View style={styles.playOverlay}>
        <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.92)" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
});
