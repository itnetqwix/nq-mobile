/**
 * PeerJoinedModal — RN port of the reactstrap "Join the meeting" prompt the web
 * shows in `portrait-calling/index.jsx → showPartnerJoinedPrompt`.
 *
 * Triggered by `CallContext.peerJoined` (set from the engine's
 * `onPeerJoined` callback which fires on the inbound `ON_CALL_JOIN` event from
 * the backend relay). Auto-dismisses after 8 s for a non-blocking flow.
 */

import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { ImageWithSkeleton } from "../../../components/ui";
import { getS3ImageUrl } from "../../../lib/imageUtils";
import { useCall } from "../CallContext";

export function PeerJoinedModal() {
  const { peerJoined, peer, acknowledgePeerJoined } = useCall();
  const name = peer?.fullname || peer?.fullName || "Your partner";
  const avatarUrl = peerJoined ? getS3ImageUrl(peer?.profile_picture) : "";
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!peerJoined) return;
    const id = setTimeout(() => acknowledgePeerJoined(), 8_000);
    return () => clearTimeout(id);
  }, [peerJoined, acknowledgePeerJoined]);

  if (!peerJoined) return null;

  return (
    <Modal
      animationType="fade"
      transparent
      visible
      onRequestClose={acknowledgePeerJoined}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {avatarUrl && !avatarFailed ? (
            <ImageWithSkeleton
              uri={avatarUrl}
              width={72}
              height={72}
              borderRadius={36}
              resizeMode="cover"
              style={styles.avatar}
              onLoadError={() => setAvatarFailed(true)}
              accessibilityLabel={`${name} photo`}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{name[0]?.toUpperCase() ?? "?"}</Text>
            </View>
          )}
          <Text style={styles.title}>{name} joined the meeting</Text>
          <Text style={styles.subtitle}>
            Your session has now begun. Say hello!
          </Text>
          <Pressable style={styles.cta} onPress={acknowledgePeerJoined}>
            <Text style={styles.ctaText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
  },
  avatarFallback: {
    backgroundColor: "#000080",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
  },
  cta: {
    marginTop: 8,
    backgroundColor: "#000080",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
  },
});
