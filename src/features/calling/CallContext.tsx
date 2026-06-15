/**
 * CallContext
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin React wrapper around `NativeCallEngine`. Mirrors the web's portrait-call
 * orchestration (peer joined modal, mute/camera toggles, end call) but exposes
 * them as a hook + provider so any component in the meeting tree (UserBox,
 * ActionButtons, PeerJoinedModal, TimeRemaining …) can read/dispatch without
 * prop-drilling.
 *
 * Consumed by `NativeMeetingScreen` which constructs the engine config from
 * the route params + cached session details. The screen is the only place
 * that creates the provider — the engine instance dies with the screen.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MediaStream } from "react-native-webrtc";

import { useSocket } from "../socket/SocketContext";
import { fetchSessionJoinReadiness } from "./sessionLiveApi";
import {
  NativeCallEngine,
  type NativeCallEngineConfig,
} from "./NativeCallEngine";
import type { LessonNetworkTier } from "./lessonNetworkTier";
import type { CallEngineStatus, CallParticipant, IceServer, SessionRole } from "./types";
import { isBenignWebRtcSignalingError } from "./webrtcSignalingErrors";

const RECOVER_CONNECTION_COOLDOWN_MS = 4_000;

export type CameraOffReason = "user" | "network" | null;

type StartArgs = {
  sessionId: string;
  fromUser: CallParticipant;
  toUser: CallParticipant;
  role: SessionRole;
  iceServers?: IceServer[];
  /** Precall join audio-only — camera starts disabled. */
  startWithCameraOff?: boolean;
};

export type PeerJoinedEvent = {
  from_user: string;
  to_user: string;
  sessionId: string;
  peerId?: string;
};

type CallContextValue = {
  status: CallEngineStatus;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peer: CallParticipant | null;
  /** True once we've received an ON_CALL_JOIN from the other side. */
  peerJoined: PeerJoinedEvent | null;
  /** True once SDP + tracks have completed and we've seen a remote stream. */
  bothJoined: boolean;
  /** Partner left session room but may rejoin (socket presence). */
  partnerDisconnected: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  remoteMicMuted: boolean;
  remoteCameraOff: boolean;
  /** Why local camera is off (user toggle vs network adaptation). */
  localCameraOffReason: CameraOffReason;
  /** Best-effort reason partner video is off. */
  remoteCameraOffReason: CameraOffReason;
  /** User explicitly turned camera off — never auto-enable for network. */
  userCameraOffIntent: boolean;
  toggleMute: () => void;
  toggleCamera: () => void;
  /** Apply encoder/resolution tier (from adaptive network hook). */
  setNetworkAdaptation: (tier: LessonNetworkTier) => void;
  /** Auto-pause camera for slow network (never touches mic). */
  setCameraPausedForNetwork: (paused: boolean) => void;
  /** Partner video off + weak quality → label as network pause. */
  markPartnerCameraNetworkPaused: (partnerWeak: boolean) => void;
  switchCamera: () => void;
  endCall: () => void;
  /** Re-announce call presence / rebuild WebRTC after reconnect or foreground. */
  recoverConnection: () => void;
  reconnectPeer: () => void;
  /** Fetch current network stats (RTT, jitter, packet loss). */
  getNetworkStats: () => Promise<{
    rttMs: number | null;
    jitterMs: number | null;
    packetLossPct: number | null;
    iceConnectionState: string;
  }>;
  /** Imperatively dismiss the peer-joined modal. */
  acknowledgePeerJoined: () => void;
  /** Last engine error, surfaced for toasts/banners. */
  lastError: string | null;
  /** Dismiss a surfaced engine error (e.g. benign WebRTC races). */
  clearLastError: () => void;
  /** Another device holds the slot; user can emit CALL_JOIN_TAKEOVER. */
  joinDeniedCanTakeOver: boolean;
  /** Displace the other device and re-join on this socket. */
  requestCallTakeover: () => void;
};

const noop = () => undefined;

const CallContext = createContext<CallContextValue>({
  status: "idle",
  localStream: null,
  remoteStream: null,
  peer: null,
  peerJoined: null,
  bothJoined: false,
  partnerDisconnected: false,
  micEnabled: true,
  cameraEnabled: true,
  remoteMicMuted: false,
  remoteCameraOff: false,
  localCameraOffReason: null,
  remoteCameraOffReason: null,
  userCameraOffIntent: false,
  toggleMute: noop,
  toggleCamera: noop,
  setNetworkAdaptation: noop,
  setCameraPausedForNetwork: noop,
  markPartnerCameraNetworkPaused: noop,
  switchCamera: noop,
  endCall: noop,
  recoverConnection: noop,
  reconnectPeer: noop,
  getNetworkStats: async () => ({
    rttMs: null,
    jitterMs: null,
    packetLossPct: null,
    iceConnectionState: "unknown",
  }),
  acknowledgePeerJoined: noop,
  lastError: null,
  clearLastError: noop,
  joinDeniedCanTakeOver: false,
  requestCallTakeover: noop,
});

export function useCall(): CallContextValue {
  return useContext(CallContext);
}

type ProviderProps = StartArgs & {
  children: React.ReactNode;
  /** Called when the call ends intentionally or session ends (not temp disconnect). */
  onEnded?: () => void;
  /** Partner explicitly ended the call (ON_CLOSE). */
  onPeerLeft?: () => void;
  /** Partner disconnected from session room — may rejoin. */
  onPeerDisconnected?: () => void;
  /** Fires the first time `ON_CALL_JOIN` is received from the other side. */
  onPeerJoined?: (info: PeerJoinedEvent) => void;
  /** Another device took over this lesson slot. */
  onSlotTakenOver?: (payload: { message?: string }) => void;
};

export function CallProvider({
  children,
  onEnded,
  onPeerLeft,
  onPeerDisconnected,
  onPeerJoined: onPeerJoinedCb,
  onSlotTakenOver,
  ...startArgs
}: ProviderProps) {
  const { socket } = useSocket();
  const engineRef = useRef<NativeCallEngine | null>(null);
  const partnerDisconnectedRef = useRef(false);
  const lastRecoverAtRef = useRef(0);
  const recoverInFlightRef = useRef(false);

  const [status, setStatus] = useState<CallEngineStatus>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerJoined, setPeerJoined] = useState<PeerJoinedEvent | null>(null);
  const [bothJoined, setBothJoined] = useState(false);
  const [partnerDisconnected, setPartnerDisconnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [remoteMicMuted, setRemoteMicMuted] = useState(false);
  const [remoteCameraOff, setRemoteCameraOff] = useState(false);
  const [localCameraOffReason, setLocalCameraOffReason] =
    useState<CameraOffReason>(null);
  const [remoteCameraOffReason, setRemoteCameraOffReason] =
    useState<CameraOffReason>(null);
  const [userCameraOffIntent, setUserCameraOffIntent] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [joinDeniedCanTakeOver, setJoinDeniedCanTakeOver] = useState(false);

  partnerDisconnectedRef.current = partnerDisconnected;

  const iceServersKey = useMemo(
    () => JSON.stringify(startArgs.iceServers ?? []),
    [startArgs.iceServers]
  );

  const fromUserRef = useRef(startArgs.fromUser);
  const toUserRef = useRef(startArgs.toUser);
  fromUserRef.current = startArgs.fromUser;
  toUserRef.current = startArgs.toUser;

  const onEndedRef = useRef(onEnded);
  const onPeerLeftRef = useRef(onPeerLeft);
  const onPeerDisconnectedRef = useRef(onPeerDisconnected);
  const onPeerJoinedRef = useRef(onPeerJoinedCb);
  const onSlotTakenOverRef = useRef(onSlotTakenOver);
  onEndedRef.current = onEnded;
  onPeerLeftRef.current = onPeerLeft;
  onPeerDisconnectedRef.current = onPeerDisconnected;
  onPeerJoinedRef.current = onPeerJoinedCb;
  onSlotTakenOverRef.current = onSlotTakenOver;

  const iceServersRef = useRef(startArgs.iceServers);
  iceServersRef.current = startArgs.iceServers;

  const stableArgs = useMemo<NativeCallEngineConfig | null>(() => {
    const fromUser = fromUserRef.current;
    const toUser = toUserRef.current;
    if (!socket || !startArgs.sessionId || !fromUser?._id || !toUser?._id) {
      return null;
    }
    return {
      socket,
      sessionId: startArgs.sessionId,
      fromUser,
      toUser,
      role: startArgs.role,
      iceServers: iceServersRef.current,
      startWithCameraOff: startArgs.startWithCameraOff,
    };
  }, [
    socket,
    startArgs.sessionId,
    startArgs.fromUser?._id,
    startArgs.toUser?._id,
    startArgs.role,
    startArgs.startWithCameraOff,
  ]);

  useEffect(() => {
    const servers = startArgs.iceServers;
    const engine = engineRef.current;
    if (!engine || !servers?.length) return;
    engine.updateIceServers(servers);
  }, [iceServersKey, startArgs.iceServers]);

  useEffect(() => {
    if (!stableArgs) return;
    let active = true;

    const engine = new NativeCallEngine(stableArgs, {
      onLocalStream: (stream) => active && setLocalStream(stream),
      onRemoteStream: (stream) => {
        if (!active) return;
        setRemoteStream(stream);
        if (stream) {
          // Remote media arrived: ensure stale "camera off" / "muted" flags
          // from previous reconnect phases do not keep the UI on avatar fallback.
          setRemoteCameraOff(false);
          setRemoteMicMuted(false);
          setPartnerDisconnected(false);
          setBothJoined(true);
        }
      },
      onStatus: (s) => active && setStatus(s),
      onPeerJoined: (info) => {
        if (!active) return;
        setPeerJoined(info);
        setPartnerDisconnected(false);
        setBothJoined(true);
        onPeerJoinedRef.current?.(info);
      },
      onBothJoined: () => active && setBothJoined(true),
      onRemoteMute: (isMuted) => active && setRemoteMicMuted(isMuted),
      onRemoteStopFeed: (videoOn) => {
        if (!active) return;
        setRemoteCameraOff(!videoOn);
        if (!videoOn) {
          setRemoteCameraOffReason((prev) => prev ?? "user");
        } else {
          setRemoteCameraOffReason(null);
        }
      },
      onPeerDisconnected: () => {
        if (!active) return;
        setPartnerDisconnected(true);
        onPeerDisconnectedRef.current?.();
      },
      onPeerLeft: () => {
        if (!active) return;
        onPeerLeftRef.current?.();
      },
      onClose: () => {
        if (!active) return;
        setStatus("ended");
        onEndedRef.current?.();
      },
      onError: (err) => {
        if (!active) return;
        const msg = err?.message ?? String(err);
        if (isBenignWebRtcSignalingError(msg)) return;
        setLastError(msg);
      },
      onJoinDenied: (payload) => {
        if (!active) return;
        setLastError(
          payload?.message ??
            "This lesson is already active on another device."
        );
        if (payload?.canTakeOver) {
          setJoinDeniedCanTakeOver(true);
          return;
        }
        setJoinDeniedCanTakeOver(false);
        setStatus("ended");
      },
      onSlotTakenOver: (payload) => {
        if (!active) return;
        setJoinDeniedCanTakeOver(false);
        setLastError(
          payload?.message ??
            "This lesson was continued on another device."
        );
        onSlotTakenOverRef.current?.({
          message: payload?.message,
        });
        setStatus("ended");
        onEndedRef.current?.();
      },
    });
    engineRef.current = engine;

    engine.start().catch((err) => {
      setLastError(err?.message ?? "Failed to start call");
    });

    if (startArgs.startWithCameraOff) {
      setCameraEnabled(false);
      setUserCameraOffIntent(true);
      setLocalCameraOffReason("user");
    }

    return () => {
      active = false;
      engineRef.current = null;
      engine.dispose();
    };
  }, [stableArgs]);

  const recoverConnection = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const st = engine.getStatus();
    if (st === "idle" || st === "ended" || st === "preparing") return;

    const now = Date.now();
    if (now - lastRecoverAtRef.current < RECOVER_CONNECTION_COOLDOWN_MS) return;
    if (recoverInFlightRef.current) return;

    lastRecoverAtRef.current = now;
    recoverInFlightRef.current = true;

    void (async () => {
      try {
        const sessionId = startArgs.sessionId;
        if (sessionId) {
          try {
            const readiness = await fetchSessionJoinReadiness(sessionId, {
              refreshIce: true,
            });
            if (readiness?.iceServers?.length) {
              engine.updateIceServers(readiness.iceServers as IceServer[]);
            }
          } catch {
            /* keep existing ICE */
          }
        }

        const currentSt = engine.getStatus();
        if (currentSt === "idle" || currentSt === "ended" || currentSt === "preparing") {
          return;
        }
        if (currentSt === "reconnecting" || partnerDisconnectedRef.current) {
          engine.reconnectPeer();
        } else {
          engine.rejoinSignal();
        }
      } finally {
        recoverInFlightRef.current = false;
      }
    })();
  }, [startArgs.sessionId]);

  /** Re-announce call presence when the socket reconnects mid-lesson (web parity). */
  useEffect(() => {
    if (!socket) return;

    const recoverCallOnSocket = () => {
      recoverConnection();
      if (socket.connected && startArgs.sessionId) {
        socket.emit("LESSON_STATE_REQUEST", { sessionId: startArgs.sessionId });
      }
    };
    socket.on("connect", recoverCallOnSocket);
    socket.on("reconnect", recoverCallOnSocket);
    return () => {
      socket.off("connect", recoverCallOnSocket);
      socket.off("reconnect", recoverCallOnSocket);
    };
  }, [socket, startArgs.sessionId, recoverConnection]);

  const toggleMute = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !micEnabled;
    engine.setMicEnabled(next);
    setMicEnabled(next);
  }, [micEnabled]);

  const toggleCamera = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !cameraEnabled;
    engine.setCameraEnabled(next);
    setCameraEnabled(next);
    if (!next) {
      setUserCameraOffIntent(true);
      setLocalCameraOffReason("user");
    } else {
      setUserCameraOffIntent(false);
      setLocalCameraOffReason(null);
    }
  }, [cameraEnabled]);

  const setCameraPausedForNetwork = useCallback((paused: boolean) => {
    const engine = engineRef.current;
    if (!engine || userCameraOffIntent) return;
    if (paused && cameraEnabled) {
      engine.setCameraEnabled(false);
      setCameraEnabled(false);
      setLocalCameraOffReason("network");
    }
  }, [cameraEnabled, userCameraOffIntent]);

  const setNetworkAdaptation = useCallback((tier: LessonNetworkTier) => {
    engineRef.current?.setNetworkAdaptation(tier);
  }, []);

  const markPartnerCameraNetworkPaused = useCallback((weak: boolean) => {
    if (!remoteCameraOff) {
      setRemoteCameraOffReason(null);
      return;
    }
    if (weak) setRemoteCameraOffReason("network");
  }, [remoteCameraOff]);

  const switchCamera = useCallback(() => {
    engineRef.current?.switchCamera();
  }, []);

  const endCall = useCallback(() => {
    engineRef.current?.endCall();
  }, []);

  const reconnectPeer = useCallback(() => {
    engineRef.current?.reconnectPeer();
  }, []);

  const getNetworkStats = useCallback(async () => {
    return (
      (await engineRef.current?.getRealtimeNetworkStats()) ?? {
        rttMs: null,
        jitterMs: null,
        packetLossPct: null,
        iceConnectionState: "unknown",
        usingRelay: false,
      }
    );
  }, []);

  const acknowledgePeerJoined = useCallback(() => setPeerJoined(null), []);

  const clearLastError = useCallback(() => {
    setLastError(null);
  }, []);

  const requestCallTakeover = useCallback(() => {
    setJoinDeniedCanTakeOver(false);
    setLastError(null);
    engineRef.current?.requestTakeover();
  }, []);

  const value = useMemo<CallContextValue>(
    () => ({
      status,
      localStream,
      remoteStream,
      peer: startArgs.toUser,
      peerJoined,
      bothJoined,
      partnerDisconnected,
      micEnabled,
      cameraEnabled,
      remoteMicMuted,
      remoteCameraOff,
      localCameraOffReason,
      remoteCameraOffReason,
      userCameraOffIntent,
      toggleMute,
      toggleCamera,
      switchCamera,
      endCall,
      recoverConnection,
      reconnectPeer,
      getNetworkStats,
      setNetworkAdaptation,
      setCameraPausedForNetwork,
      markPartnerCameraNetworkPaused,
      acknowledgePeerJoined,
      lastError,
      clearLastError,
      joinDeniedCanTakeOver,
      requestCallTakeover,
    }),
    [
      status,
      localStream,
      remoteStream,
      startArgs.toUser,
      peerJoined,
      bothJoined,
      partnerDisconnected,
      micEnabled,
      cameraEnabled,
      remoteMicMuted,
      remoteCameraOff,
      localCameraOffReason,
      remoteCameraOffReason,
      userCameraOffIntent,
      toggleMute,
      toggleCamera,
      switchCamera,
      endCall,
      recoverConnection,
      reconnectPeer,
      getNetworkStats,
      setNetworkAdaptation,
      setCameraPausedForNetwork,
      markPartnerCameraNetworkPaused,
      acknowledgePeerJoined,
      lastError,
      clearLastError,
      joinDeniedCanTakeOver,
      requestCallTakeover,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
