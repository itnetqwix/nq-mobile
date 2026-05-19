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
import {
  NativeCallEngine,
  type NativeCallEngineConfig,
} from "./NativeCallEngine";
import type { CallEngineStatus, CallParticipant, IceServer, SessionRole } from "./types";

type StartArgs = {
  sessionId: string;
  fromUser: CallParticipant;
  toUser: CallParticipant;
  role: SessionRole;
  iceServers?: IceServer[];
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
  micEnabled: boolean;
  cameraEnabled: boolean;
  remoteMicMuted: boolean;
  remoteCameraOff: boolean;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  endCall: () => void;
  /** Imperatively dismiss the peer-joined modal. */
  acknowledgePeerJoined: () => void;
  /** Last engine error, surfaced for toasts/banners. */
  lastError: string | null;
};

const noop = () => undefined;

const CallContext = createContext<CallContextValue>({
  status: "idle",
  localStream: null,
  remoteStream: null,
  peer: null,
  peerJoined: null,
  bothJoined: false,
  micEnabled: true,
  cameraEnabled: true,
  remoteMicMuted: false,
  remoteCameraOff: false,
  toggleMute: noop,
  toggleCamera: noop,
  switchCamera: noop,
  endCall: noop,
  acknowledgePeerJoined: noop,
  lastError: null,
});

export function useCall(): CallContextValue {
  return useContext(CallContext);
}

type ProviderProps = StartArgs & {
  children: React.ReactNode;
  /** Called when the engine closes (locally or remotely). Screen uses this to
   *  pop the navigation stack. */
  onEnded?: () => void;
  /** Specifically fires when the remote peer left mid-call (their socket
   *  emitted ON_CLOSE while we were still active). Lets the screen surface a
   *  notification before the call tears down. */
  onPeerLeft?: () => void;
  /** Fires the first time `ON_CALL_JOIN` is received from the other side.
   *  Used by the screen to surface a "User joined" notification. */
  onPeerJoined?: (info: PeerJoinedEvent) => void;
};

export function CallProvider({
  children,
  onEnded,
  onPeerLeft,
  onPeerJoined: onPeerJoinedCb,
  ...startArgs
}: ProviderProps) {
  const { socket } = useSocket();
  const engineRef = useRef<NativeCallEngine | null>(null);

  const [status, setStatus] = useState<CallEngineStatus>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerJoined, setPeerJoined] = useState<PeerJoinedEvent | null>(null);
  const [bothJoined, setBothJoined] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [remoteMicMuted, setRemoteMicMuted] = useState(false);
  const [remoteCameraOff, setRemoteCameraOff] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

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
  const onPeerJoinedRef = useRef(onPeerJoinedCb);
  onEndedRef.current = onEnded;
  onPeerLeftRef.current = onPeerLeft;
  onPeerJoinedRef.current = onPeerJoinedCb;

  /** Memoise primitive identifiers so the engine effect doesn't re-run on
   *  every parent render (unstable object refs were recreating the engine ~5s). */
  const stableArgs = useMemo<NativeCallEngineConfig | null>(() => {
    const fromUser = fromUserRef.current;
    const toUser = toUserRef.current;
    if (!socket || !startArgs.sessionId || !fromUser?._id || !toUser?._id) {
      return null;
    }
    const iceServers = startArgs.iceServers;
    return {
      socket,
      sessionId: startArgs.sessionId,
      fromUser,
      toUser,
      role: startArgs.role,
      iceServers,
    };
  }, [
    socket,
    startArgs.sessionId,
    startArgs.fromUser?._id,
    startArgs.toUser?._id,
    startArgs.role,
    iceServersKey,
  ]);

  useEffect(() => {
    if (!stableArgs) return;
    let active = true;

    const engine = new NativeCallEngine(stableArgs, {
      onLocalStream: (stream) => active && setLocalStream(stream),
      onRemoteStream: (stream) => active && setRemoteStream(stream),
      onStatus: (s) => active && setStatus(s),
      onPeerJoined: (info) => {
        if (!active) return;
        setPeerJoined(info);
        /** Partner announced via socket — unlock lesson UI even before video tracks. */
        setBothJoined(true);
        onPeerJoinedRef.current?.(info);
      },
      onBothJoined: () => active && setBothJoined(true),
      onRemoteMute: (isMuted) => active && setRemoteMicMuted(isMuted),
      onRemoteStopFeed: (videoOn) => active && setRemoteCameraOff(!videoOn),
      onPeerLeft: () => {
        if (!active) return;
        onPeerLeftRef.current?.();
      },
      onClose: () => {
        if (!active) return;
        setStatus("ended");
        onEndedRef.current?.();
      },
      onError: (err) => active && setLastError(err.message),
    });
    engineRef.current = engine;

    engine.start().catch((err) => {
      setLastError(err?.message ?? "Failed to start call");
    });

    return () => {
      active = false;
      engineRef.current = null;
      engine.dispose();
    };
  }, [stableArgs]);

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
  }, [cameraEnabled]);

  const switchCamera = useCallback(() => {
    engineRef.current?.switchCamera();
  }, []);

  const endCall = useCallback(() => {
    engineRef.current?.endCall();
  }, []);

  const acknowledgePeerJoined = useCallback(() => setPeerJoined(null), []);

  const value = useMemo<CallContextValue>(
    () => ({
      status,
      localStream,
      remoteStream,
      peer: startArgs.toUser,
      peerJoined,
      bothJoined,
      micEnabled,
      cameraEnabled,
      remoteMicMuted,
      remoteCameraOff,
      toggleMute,
      toggleCamera,
      switchCamera,
      endCall,
      acknowledgePeerJoined,
      lastError,
    }),
    [
      status,
      localStream,
      remoteStream,
      startArgs.toUser,
      peerJoined,
      bothJoined,
      micEnabled,
      cameraEnabled,
      remoteMicMuted,
      remoteCameraOff,
      toggleMute,
      toggleCamera,
      switchCamera,
      endCall,
      acknowledgePeerJoined,
      lastError,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
