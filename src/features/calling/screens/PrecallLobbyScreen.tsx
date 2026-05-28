import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  RTCView,
  mediaDevices,
  type MediaStream,
  type MediaStreamTrack,
} from "react-native-webrtc";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";
import { useCallPreferences } from "../useCallPreferences";
import { useAudioRoute } from "../useAudioRoute";

type Quality = "fast" | "good" | "weak" | "unknown";

type NetworkProbe = {
  loading: boolean;
  quality: Quality;
  rttMs: number | null;
  mbps: number | null;
};

type Props = {
  lessonId: string;
  onJoin: (preferences: { blurEnabled: boolean }) => void;
  onCancel: () => void;
};

/**
 * Pre-call lobby. Trainee/trainer lands here before the actual session
 * mounts, so they can:
 *   - confirm their camera frames a usable shot
 *   - speak into the mic and watch a live level meter
 *   - see how well their connection will support video
 *   - flip the background-blur preference on/off
 *
 * The lobby acquires its own short-lived `getUserMedia` stream for the
 * preview; we stop all tracks when the user taps Join so the underlying
 * call engine can re-acquire its own (this avoids "device busy" issues
 * on some Android handsets).
 */
export function PrecallLobbyScreen({ lessonId, onJoin, onCancel }: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const { blurEnabled, setBlurEnabled: persistBlurEnabled } = useCallPreferences();
  const [localBlurEnabled, setLocalBlurEnabled] = useState(blurEnabled);
  const [network, setNetwork] = useState<NetworkProbe>({
    loading: true,
    quality: "unknown",
    rttMs: null,
    mbps: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const audioRoute = useAudioRoute();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ms = (await mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 720 },
            height: { ideal: 1280 },
            frameRate: { ideal: 24, max: 30 },
          },
        })) as unknown as MediaStream;
        if (cancelled) {
          ms.getTracks().forEach((t: MediaStreamTrack) => t.stop());
          return;
        }
        streamRef.current = ms;
        setStream(ms);
      } catch (err) {
        if (!cancelled) setPermissionDenied(true);
      }
    })();
    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) {
        try {
          s.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        } catch {
          /* noop */
        }
      }
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = micOn;
    });
  }, [stream, micOn]);

  useEffect(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((track: MediaStreamTrack) => {
      track.enabled = cameraOn;
    });
  }, [stream, cameraOn]);

  const runNetworkProbe = useCallback(async () => {
    setNetwork({ loading: true, quality: "unknown", rttMs: null, mbps: null });
    const pingUrl = `https://www.google.com/generate_204?ts=${Date.now()}`;
    const pingSamples: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const started = Date.now();
      try {
        await fetch(`${pingUrl}&p=${i}`, { method: "GET", cache: "no-store" as any });
        pingSamples.push(Date.now() - started);
      } catch {
        // keep trying next sample
      }
    }
    const rttMs = pingSamples.length
      ? Math.round(pingSamples.reduce((sum, v) => sum + v, 0) / pingSamples.length)
      : null;
    if (rttMs == null) {
      setNetwork({ loading: false, quality: "weak", rttMs: null, mbps: null });
      return;
    }

    let mbps: number | null = null;
    try {
      const probeUrl = `https://speed.cloudflare.com/__down?bytes=250000&ts=${Date.now()}`;
      const dlStart = Date.now();
      const res = await fetch(probeUrl, { cache: "no-store" as any });
      const blob = await res.blob();
      const elapsedSec = Math.max(0.01, (Date.now() - dlStart) / 1000);
      const bytes = (blob as any).size ?? 5000;
      mbps = (bytes * 8) / (elapsedSec * 1_000_000);
    } catch {
      mbps = null;
    }

    let quality: Quality = "good";
    if ((rttMs ?? 0) < 90 && (mbps ?? 0) > 1.5) quality = "fast";
    else if ((rttMs ?? 0) > 260 || (mbps !== null && mbps < 0.4)) quality = "weak";
    setNetwork({ loading: false, quality, rttMs, mbps });
  }, []);

  useEffect(() => {
    void runNetworkProbe();
  }, [runNetworkProbe]);

  useEffect(() => {
    setLocalBlurEnabled(blurEnabled);
  }, [blurEnabled]);

  const handleBlurToggle = async (next: boolean) => {
    setLocalBlurEnabled(next);
    await persistBlurEnabled(next);
  };

  const handleFlipCamera = () => {
    const track = stream?.getVideoTracks?.()[0] as (MediaStreamTrack & { _switchCamera?: () => void }) | undefined;
    if (track?._switchCamera) {
      track._switchCamera();
    }
  };

  const handleJoin = () => {
    haptics.success();
    onJoin({ blurEnabled: localBlurEnabled });
  };

  const videoTrack = stream?.getVideoTracks?.()[0];
  const streamId = (stream as unknown as { toURL?: () => string })?.toURL?.();

  const networkColor =
    network.quality === "fast"
      ? c.success
      : network.quality === "weak"
        ? c.error
        : network.quality === "good"
          ? c.warning
          : c.textMuted;

  const networkLabel =
    network.quality === "fast"
      ? t("precall.netFast")
      : network.quality === "good"
        ? t("precall.netGood")
        : network.quality === "weak"
          ? t("precall.netWeak")
          : t("precall.netChecking");

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.shell, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel="Cancel">
          <Ionicons name="close" size={26} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>
            {t("precall.title")}
          </Text>
          <Text style={[styles.headerSub, { color: c.textMuted }]}>
            {t("precall.subtitle")}
          </Text>
        </View>
      </View>

      <View style={[styles.previewWrap, { backgroundColor: "#0d0d10" }]}>
        {streamId && videoTrack && cameraOn ? (
          <RTCView
            streamURL={streamId}
            style={styles.preview}
            objectFit="cover"
            mirror
            zOrder={1}
          />
        ) : (
          <View style={styles.previewPlaceholder}>
            {permissionDenied ? (
              <>
                <Ionicons name="alert-circle-outline" size={32} color="#ff8a80" />
                <Text style={styles.previewText}>
                  {t("precall.permissionDenied")}
                </Text>
              </>
            ) : !stream ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.previewText}>{t("precall.starting")}</Text>
              </>
            ) : (
              <>
                <Ionicons name="videocam-off-outline" size={32} color="#ffffffb3" />
                <Text style={styles.previewText}>{t("precall.cameraOff")}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.previewControls}>
          <Pressable
            onPress={() => setCameraOn((v) => !v)}
            style={[
              styles.previewToggle,
              { backgroundColor: cameraOn ? "#ffffff22" : "#ff5252" },
            ]}
            accessibilityLabel={cameraOn ? "Turn camera off" : "Turn camera on"}
          >
            <Ionicons
              name={cameraOn ? "videocam" : "videocam-off"}
              size={18}
              color="#fff"
            />
          </Pressable>
          <Pressable
            onPress={() => setMicOn((v) => !v)}
            style={[
              styles.previewToggle,
              { backgroundColor: micOn ? "#ffffff22" : "#ff5252" },
            ]}
            accessibilityLabel={micOn ? "Mute mic" : "Unmute mic"}
          >
            <Ionicons name={micOn ? "mic" : "mic-off"} size={18} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleFlipCamera}
            style={styles.previewToggle}
            accessibilityLabel="Switch front and back camera"
          >
            <Ionicons name="camera-reverse-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
          <View style={styles.statHeader}>
            <Ionicons name="mic-outline" size={14} color={c.brandNavy} />
            <Text style={[styles.statLabel, { color: c.textMuted }]}>
              {t("precall.micLabel")}
            </Text>
          </View>
          <View style={styles.micMeterRow}>
            {[0, 1, 2, 3, 4].map((i) => {
              const activeBars = micOn && stream ? 4 : 0;
              return (
                <View
                  key={i}
                  style={[
                    styles.micBar,
                    {
                      backgroundColor:
                        i < 3
                          ? c.success
                          : i < 4
                            ? c.warning
                            : c.error,
                      opacity: i <= activeBars ? 0.9 : 0.12,
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text style={[styles.statHint, { color: c.textMuted }]}>
            {micOn && stream
              ? t("precall.micHintOn")
              : t("precall.micHintOff")}
          </Text>
        </View>

        <View style={[styles.statCard, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
          <View style={styles.statHeader}>
            <Ionicons name="wifi-outline" size={14} color={c.brandNavy} />
            <Text style={[styles.statLabel, { color: c.textMuted }]}>
              {t("precall.netLabel")}
            </Text>
            <Pressable
              onPress={() => void runNetworkProbe()}
              hitSlop={6}
              accessibilityLabel="Retest"
            >
              <Ionicons name="refresh-outline" size={14} color={c.textMuted} />
            </Pressable>
          </View>
          <View style={styles.netPill}>
            <View
              style={[styles.netDot, { backgroundColor: networkColor }]}
            />
            <Text style={[styles.netLabel, { color: c.text }]}>
              {network.loading ? t("precall.netChecking") : networkLabel}
            </Text>
          </View>
          <Text style={[styles.statHint, { color: c.textMuted }]}>
            {network.rttMs != null
              ? t("precall.netDetail", {
                  rtt: network.rttMs,
                  mbps:
                    network.mbps != null
                      ? network.mbps.toFixed(1)
                      : "—",
                })
              : t("precall.netDetailUnknown")}
          </Text>
        </View>
      </View>

      <View style={[styles.blurRow, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
        <Ionicons name="contrast-outline" size={16} color={c.brandNavy} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.blurTitle, { color: c.text }]}>
            {t("precall.blurTitle")}
          </Text>
          <Text style={[styles.blurSub, { color: c.textMuted }]}>
            {t("precall.blurSub")}
          </Text>
        </View>
        <Switch
          value={blurEnabled}
          onValueChange={handleBlurToggle}
          trackColor={{ false: c.surfaceMuted, true: c.brandAccent }}
          thumbColor="#fff"
          ios_backgroundColor={c.surfaceMuted}
        />
      </View>

      <View style={[styles.blurRow, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
        <Ionicons name="volume-high-outline" size={16} color={c.brandNavy} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.blurTitle, { color: c.text }]}>Audio device</Text>
          <Text style={[styles.blurSub, { color: c.textMuted }]}>
            {audioRoute.routeLabel}
            {audioRoute.hasBluetooth ? " (Bluetooth connected)" : ""}
          </Text>
        </View>
        <Pressable
          onPress={audioRoute.toggleAudioRoute}
          style={[styles.routeBtn, { borderColor: c.border }]}
          accessibilityRole="button"
          accessibilityLabel="Switch audio route"
        >
          <Text style={[styles.routeBtnText, { color: c.brandNavy }]}>Switch</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={handleJoin}
          style={[
            styles.joinBtn,
            { backgroundColor: c.brandNavy, opacity: permissionDenied ? 0.45 : 1 },
          ]}
          disabled={permissionDenied}
          accessibilityRole="button"
        >
          <Ionicons name="videocam" size={18} color={c.brandTextOn} />
          <Text style={[styles.joinText, { color: c.brandTextOn }]}>
            {t("precall.joinCta")}
          </Text>
        </Pressable>
        <Text style={[styles.legalText, { color: c.textMuted }]}>
          {t("precall.lessonId", { id: lessonId })}
        </Text>
      </View>
    </ScrollView>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      shell: {
        backgroundColor: palette.background,
        paddingHorizontal: space.md,
        gap: space.md,
        flexGrow: 1,
      },
      scroll: { flex: 1, backgroundColor: palette.background },
      headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
      headerTitle: { ...typography.titleMd, fontWeight: "800" },
      headerSub: { ...typography.bodySm, marginTop: 2 },
      previewWrap: {
        borderRadius: radii.lg,
        overflow: "hidden",
        aspectRatio: 3 / 4,
        position: "relative",
      },
      preview: { width: "100%", height: "100%" },
      previewPlaceholder: {
        position: "absolute",
        inset: 0 as any,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      },
      previewText: { color: "#fff", fontWeight: "700", marginTop: 6 },
      previewControls: {
        position: "absolute",
        bottom: 12,
        flexDirection: "row",
        gap: 10,
        alignSelf: "center",
      },
      previewToggle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
      },
      statsGrid: { flexDirection: "row", gap: space.sm },
      statCard: {
        flex: 1,
        padding: space.sm,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: 8,
      },
      statHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
      statLabel: {
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.6,
        flex: 1,
      },
      statHint: { fontSize: 10, fontWeight: "600" },
      micMeterRow: { flexDirection: "row", gap: 4, alignItems: "flex-end", height: 18 },
      micBar: { flex: 1, height: "100%", borderRadius: 2 },
      netPill: { flexDirection: "row", alignItems: "center", gap: 6 },
      netDot: { width: 10, height: 10, borderRadius: 5 },
      netLabel: { fontSize: 13, fontWeight: "700" },
      blurRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: space.sm,
        borderRadius: radii.md,
        borderWidth: 1,
      },
      blurTitle: { ...typography.bodyMd, fontWeight: "700" },
      blurSub: { ...typography.caption, marginTop: 2 },
      routeBtn: {
        borderWidth: 1,
        borderRadius: radii.sm,
        paddingHorizontal: 10,
        paddingVertical: 6,
      },
      routeBtnText: { ...typography.bodySm, fontWeight: "700" },
      actions: { marginTop: "auto", gap: 6 },
      joinBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 14,
        borderRadius: radii.pill,
      },
      joinText: { fontSize: 15, fontWeight: "800" },
      legalText: { fontSize: 10, fontWeight: "600", textAlign: "center" },
    })
  );
}
