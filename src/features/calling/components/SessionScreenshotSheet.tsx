/**
 * In-call screenshot gallery (web `screenshotDetails.jsx` parity).
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getS3ImageUrl } from "../../../lib/imageUtils";
import { normalizeReportImageKeys } from "../reportDataUtils";
import { fetchSessionReport } from "../meetingReportApi";

type Props = {
  visible: boolean;
  sessionId: string;
  trainerId: string;
  traineeId: string;
  onClose: () => void;
  /** Keys already known locally (e.g. after a fresh capture). */
  extraKeys?: string[];
};

export function SessionScreenshotSheet({
  visible,
  sessionId,
  trainerId,
  traineeId,
  onClose,
  extraKeys = [],
}: Props) {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSessionReport({
        sessions: sessionId,
        trainer: trainerId,
        trainee: traineeId,
      });
      const data = res?.data ?? res;
      const fromApi = normalizeReportImageKeys(data?.reportData);
      const merged = [...new Set([...fromApi, ...extraKeys])];
      setImages(merged);
    } catch {
      setImages([...new Set(extraKeys)]);
    } finally {
      setLoading(false);
    }
  }, [extraKeys, sessionId, traineeId, trainerId]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Session screenshots</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close gallery">
            <Ionicons name="close" size={26} color="#111" />
          </Pressable>
        </View>
        <Text style={styles.sub}>
          Screenshots are saved for your post-call game plan PDF. Capture more from the camera
          button during the lesson.
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} />
        ) : images.length === 0 ? (
          <Text style={styles.empty}>No screenshots yet. Use the camera button during the call.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {images.map((key) => (
              <Image
                key={key}
                source={{ uri: getS3ImageUrl(key) }}
                style={styles.thumb}
              />
            ))}
          </ScrollView>
        )}

        <Pressable style={styles.doneBtn} onPress={onClose}>
          <Text style={styles.doneText}>Continue lesson</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 56, paddingHorizontal: 20, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#0b1f3a" },
  sub: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 16 },
  empty: { marginTop: 24, color: "#666", fontSize: 15 },
  strip: { gap: 12, paddingVertical: 8 },
  thumb: {
    width: 200,
    height: 140,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  doneBtn: {
    marginTop: "auto",
    marginBottom: 32,
    backgroundColor: "#0b1f3a",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  doneText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
