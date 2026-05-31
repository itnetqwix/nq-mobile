import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import { useQuery } from "@tanstack/react-query";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getClipThumbnailUrl } from "../../../lib/clipMediaUrl";
import { haptics } from "../../../lib/haptics";
import { radii, space, typography, useThemedStyles, useThemeColors } from "../../../theme";
import {
  fetchLessonCallSlotStatus,
  postLessonCallSlotTakeover,
} from "../api/lessonCallSlotApi";
import { fetchSessionJoinReadiness } from "../sessionLiveApi";
import { precallNetworkLabel } from "../meetingUx";
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
  onJoin: (preferences: { blurEnabled: boolean; joinAudioOnly?: boolean }) => void;
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
  const {
    blurEnabled,
    joinAudioOnly: savedJoinAudioOnly,
    setBlurEnabled: persistBlurEnabled,
    setJoinAudioOnly: persistJoinAudioOnly,
  } = useCallPreferences();
  const [joinAudioOnly, setJoinAudioOnly] = useState(savedJoinAudioOnly);
  const [localBlurEnabled, setLocalBlurEnabled] = useState(blurEnabled);
  const [network, setNetwork] = useState<NetworkProbe>({
    loading: true,
    quality: "unknown",
    rttMs: null,
    mbps: null,
  });
  const [callSlotBlocked, setCallSlotBlocked] = useState(false);
  const [callSlotCanTakeOver, setCallSlotCanTakeOver] = useState(false);
  const [callSlotMessage, setCallSlotMessage] = useState<string | null>(null);
  const [callSlotChecking, setCallSlotChecking] = useState(true);
  const [takeoverBusy, setTakeoverBusy] = useState(false);

  const { data: readiness } = useQuery({
    queryKey: ["session", "join-readiness", lessonId],
    queryFn: () => fetchSessionJoinReadiness(lessonId),
    staleTime: 30_000,
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
    let cancelled = false;
    (async () => {
      setCallSlotChecking(true);
      try {
        const status = await fetchLessonCallSlotStatus(lessonId);
        if (cancelled) return;
        if (!status.canJoin) {
          setCallSlotBlocked(true);
          setCallSlotCanTakeOver(!!status.canTakeOver);
          setCallSlotMessage(
            status.canTakeOver
              ? "This lesson is open on another device. You can take over here to continue on this phone."
              : "This lesson is already active on another device. Leave that session first, then try again."
          );
        } else {
          setCallSlotBlocked(false);
          setCallSlotCanTakeOver(false);
          setCallSlotMessage(null);
        }
      } catch {
        if (!cancelled) {
          setCallSlotBlocked(false);
          setCallSlotMessage(null);
        }
      } finally {
        if (!cancelled) setCallSlotChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  useEffect(() => {
    setLocalBlurEnabled(blurEnabled);
  }, [blurEnabled]);

  useEffect(() => {
    setJoinAudioOnly(savedJoinAudioOnly);
  }, [savedJoinAudioOnly]);

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

  const releasePreviewTracks = () => {
    const s = streamRef.current;
    if (s) {
      try {
        s.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      } catch {
        /* noop */
      }
    }
    streamRef.current = null;
    setStream(null);
  };

  const handleJoin = (audioOnly = false) => {
    if (callSlotBlocked && !callSlotCanTakeOver) {
      Alert.alert(
        "Session active elsewhere",
        callSlotMessage ??
          "This lesson is already open on another device."
      );
      return;
    }
    haptics.success();
    releasePreviewTracks();
    const useAudioOnly = audioOnly || joinAudioOnly;
    void persistJoinAudioOnly(useAudioOnly);
    onJoin({ blurEnabled: localBlurEnabled, joinAudioOnly: useAudioOnly });
  };

  const handleTakeoverAndJoin = async () => {
    if (!callSlotCanTakeOver || takeoverBusy) return;
    setTakeoverBusy(true);
    try {
      await postLessonCallSlotTakeover(lessonId);
      setCallSlotBlocked(false);
      setCallSlotCanTakeOver(false);
      setCallSlotMessage(null);
      haptics.success();
      releasePreviewTracks();
      onJoin({
        blurEnabled: localBlurEnabled,
        joinAudioOnly: joinAudioOnly,
      });
    } catch {
      Alert.alert(
        "Could not take over",
        "Another device may still be in this lesson. Try again in a moment."
      );
    } finally {
      setTakeoverBusy(false);
    }
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

  const networkLabel = precallNetworkLabel(network.quality, network.loading);

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
                <Pressable
                  onPress={() => void Linking.openSettings()}
                  style={[styles.settingsLink, { borderColor: c.brandAccent }]}
                >
                  <Text style={[styles.settingsLinkText, { color: c.brandAccent }]}>
                    Open Settings
                  </Text>
                </Pressable>
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

      {readiness ? (
        <View style={[styles.sessionBrief, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
          <Text style={[styles.briefTitle, { color: c.text }]}>
            {readiness.peer?.fullname
              ? `Lesson with ${readiness.peer.fullname}`
              : "Your upcoming lesson"}
          </Text>
          {readiness.duration_minutes ? (
            <Text style={[styles.briefMeta, { color: c.textMuted }]}>
              {readiness.duration_minutes} min
              {readiness.is_instant ? " · Instant lesson" : " · Scheduled"}
            </Text>
          ) : null}
          {readiness.clip_count > 0 ? (
            <Text style={[styles.briefMeta, { color: c.textMuted }]}>
              {readiness.clip_count} clip{readiness.clip_count === 1 ? "" : "s"} attached
            </Text>
          ) : null}
          {readiness.extension_preview?.allowed ? (
            <Text style={[styles.briefMeta, { color: c.textMuted }]}>
              Quick extend available · +10 min from $
              {readiness.extension_preview.amount.toFixed(0)}
            </Text>
          ) : null}
          {readiness.clips.slice(0, 3).map((clip) => {
            const thumb = getClipThumbnailUrl(clip);
            return (
              <View key={clip._id} style={styles.clipRow}>
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.clipThumb} />
                ) : (
                  <View style={[styles.clipThumb, styles.clipThumbFallback]}>
                    <Ionicons name="film-outline" size={14} color={c.textMuted} />
                  </View>
                )}
                <Text style={[styles.clipTitle, { color: c.text }]} numberOfLines={1}>
                  {clip.title}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

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
            Background dim
          </Text>
          <Text style={[styles.blurSub, { color: c.textMuted }]}>
            Softens your background on this device (not full blur yet).
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

      {network.quality === "weak" && !network.loading ? (
        <View
          style={[
            styles.slotBanner,
            {
              backgroundColor: c.warning + "22",
              borderColor: c.warning,
            },
          ]}
        >
          <Ionicons name="warning-outline" size={18} color={c.warning} />
          <Text style={[styles.slotBannerText, { color: c.warning }]}>
            Weak connection detected. You can join audio-only — video may pause automatically to save data.
          </Text>
        </View>
      ) : null}

      <View style={[styles.blurRow, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
        <Ionicons name="headset-outline" size={16} color={c.brandNavy} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.blurTitle, { color: c.text }]}>Join audio-only</Text>
          <Text style={[styles.blurSub, { color: c.textMuted }]}>
            Start with camera off to use less data. You can turn video on later when your network improves.
          </Text>
        </View>
        <Switch
          value={joinAudioOnly}
          onValueChange={(v) => {
            setJoinAudioOnly(v);
            void persistJoinAudioOnly(v);
          }}
          trackColor={{ false: c.surfaceMuted, true: c.brandAccent }}
          thumbColor="#fff"
          ios_backgroundColor={c.surfaceMuted}
        />
      </View>

      {callSlotBlocked && callSlotMessage ? (
        <View
          style={[
            styles.slotBanner,
            {
              backgroundColor: (callSlotCanTakeOver ? c.warning : c.error) + "22",
              borderColor: callSlotCanTakeOver ? c.warning : c.error,
            },
          ]}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={18}
            color={callSlotCanTakeOver ? c.warning : c.error}
          />
          <Text
            style={[
              styles.slotBannerText,
              { color: callSlotCanTakeOver ? c.warning : c.error },
            ]}
          >
            {callSlotMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {callSlotBlocked && callSlotCanTakeOver ? (
          <Pressable
            onPress={() => void handleTakeoverAndJoin()}
            style={[
              styles.joinBtn,
              {
                backgroundColor: c.brandAccent,
                opacity:
                  permissionDenied || callSlotChecking || takeoverBusy ? 0.45 : 1,
              },
            ]}
            disabled={permissionDenied || callSlotChecking || takeoverBusy}
            accessibilityRole="button"
          >
            {takeoverBusy ? (
              <ActivityIndicator color={c.brandTextOn} />
            ) : (
              <Ionicons name="swap-horizontal" size={18} color={c.brandTextOn} />
            )}
            <Text style={[styles.joinText, { color: c.brandTextOn }]}>
              Take over on this device
            </Text>
          </Pressable>
        ) : null}
        {network.quality === "weak" && !network.loading ? (
          <Pressable
            onPress={() => handleJoin(true)}
            style={[
              styles.joinBtn,
              {
                backgroundColor: c.brandAccent,
                opacity:
                  permissionDenied ||
                  callSlotChecking ||
                  (callSlotBlocked && !callSlotCanTakeOver)
                    ? 0.45
                    : 1,
              },
            ]}
            disabled={
              permissionDenied ||
              callSlotChecking ||
              (callSlotBlocked && !callSlotCanTakeOver)
            }
            accessibilityRole="button"
          >
            <Ionicons name="mic" size={18} color={c.brandTextOn} />
            <Text style={[styles.joinText, { color: c.brandTextOn }]}>
              Join audio-only (recommended)
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => handleJoin(false)}
          style={[
            styles.joinBtn,
            {
              backgroundColor: c.brandNavy,
              opacity:
                permissionDenied ||
                callSlotChecking ||
                (callSlotBlocked && !callSlotCanTakeOver)
                  ? 0.45
                  : 1,
            },
          ]}
          disabled={
            permissionDenied ||
            callSlotChecking ||
            (callSlotBlocked && !callSlotCanTakeOver)
          }
          accessibilityRole="button"
        >
          <Ionicons name="videocam" size={18} color={c.brandTextOn} />
          <Text style={[styles.joinText, { color: c.brandTextOn }]}>
            {callSlotCanTakeOver && callSlotBlocked
              ? "Join without taking over"
              : t("precall.joinCta")}
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
      sessionBrief: {
        borderWidth: 1,
        borderRadius: radii.md,
        padding: space.sm,
        gap: 6,
      },
      briefTitle: { ...typography.bodyMd, fontWeight: "800" },
      briefMeta: { ...typography.caption, fontWeight: "600" },
      clipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
      clipThumb: { width: 36, height: 36, borderRadius: 6, backgroundColor: palette.border },
      clipThumbFallback: { alignItems: "center", justifyContent: "center" },
      clipTitle: { ...typography.bodySm, flex: 1, fontWeight: "600" },
      slotBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        borderRadius: radii.md,
      },
      slotBannerText: { ...typography.bodySm, flex: 1 },
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
      settingsLink: {
        marginTop: 10,
        borderWidth: 1,
        borderRadius: radii.pill,
        paddingHorizontal: 14,
        paddingVertical: 8,
      },
      settingsLinkText: { fontSize: 13, fontWeight: "700" },
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
