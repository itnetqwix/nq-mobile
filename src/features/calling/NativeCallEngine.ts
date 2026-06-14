/**
 * NativeCallEngine
 * ─────────────────────────────────────────────────────────────────────────────
 * React-Native port of the web `app/components/video/callEngine.js` semantics
 * using `react-native-webrtc` (plain libwebrtc, no PeerJS).
 *
 * Mobile-to-mobile interop is fully native via this engine. Mobile-to-web is
 * **not** native because the web side uses PeerJS for SDP/ICE — for those mixed
 * calls the WebView fallback path (`MeetingScreen`) is used. The plan documents
 * this trade-off: the feature flag in `RootNavigator` decides which screen
 * mounts.
 *
 * Wire shape parity is critical even though we don't talk PeerJS: every emit
 * carries `userInfo: { from_user, to_user, sessionId, peerId }` so the backend's
 * MemCache routing (`nq-backend-main/src/modules/socket/socket.service.ts`)
 * still routes the events correctly to the right peer.
 */

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
  type MediaStreamTrack,
} from "react-native-webrtc";
import type { Socket } from "socket.io-client";
import InCallManager from "react-native-incall-manager";

import { CALL_EVENTS } from "./callEvents";
import { LESSON_SOCKET_EVENTS } from "../../lib/sessions/sessionContract";
import { reportOpsEvent } from "../ops/opsEventsApi";
import { buildIceConfig, DEFAULT_ICE_SERVERS, sanitizeIceServers } from "./iceServers";
import { isWebRTCModuleLinked } from "./nativeCallAvailability";
import {
  LESSON_NETWORK_TIER_CONFIG,
  type LessonNetworkTier,
} from "./lessonNetworkTier";
import type {
  CallEngineStatus,
  CallParticipant,
  IceServer,
  SessionRole,
} from "./types";

export type NativeCallEngineConfig = {
  socket: Socket;
  sessionId: string;
  fromUser: CallParticipant;
  toUser: CallParticipant;
  role: SessionRole;
  /** Optional TURN credentials from `POST /common/start-meeting`. */
  iceServers?: IceServer[];
  /** Whether to default to speakerphone (true for video lessons). */
  speakerphoneOn?: boolean;
  /** Precall "join audio-only" — start with camera disabled. */
  startWithCameraOff?: boolean;
};

export type NativeCallEngineEvents = {
  /** Local camera/mic stream once getUserMedia resolves. */
  onLocalStream?: (stream: MediaStream) => void;
  /** Remote stream once an ontrack fires from the peer connection. */
  onRemoteStream?: (stream: MediaStream | null) => void;
  /** Lifecycle status change. */
  onStatus?: (status: CallEngineStatus) => void;
  /** Peer (the other party) announced they joined. Used to surface the
   *  "X joined the meeting" modal mirroring web `showPartnerJoinedPrompt`. */
  onPeerJoined?: (info: {
    from_user: string;
    to_user: string;
    sessionId: string;
    peerId?: string;
  }) => void;
  /** Backend says both sides are in the room; safe to drive the lesson timer. */
  onBothJoined?: () => void;
  /** Remote toggled their mic. */
  onRemoteMute?: (isMuted: boolean) => void;
  /** Remote toggled their camera (feedStatus true = video on). */
  onRemoteStopFeed?: (videoOn: boolean) => void;
  /** Engine has hung up locally or remotely. */
  onClose?: () => void;
  /** Partner left the session room (may rejoin) — stay in meeting UI. */
  onPeerDisconnected?: () => void;
  /** Partner explicitly ended the call or session ended. */
  onPeerLeft?: () => void;
  /** Non-fatal warning. */
  onError?: (err: Error) => void;
  /** Server rejected join — lesson active on another device. */
  onJoinDenied?: (payload: {
    sessionId?: string;
    reason?: string;
    message?: string;
    canTakeOver?: boolean;
  }) => void;
  /** Another device took over this session. */
  onSlotTakenOver?: (payload: { sessionId?: string; message?: string }) => void;
};

const log = (...args: any[]) => {
  // eslint-disable-next-line no-console
  console.log("[NativeCallEngine]", ...args);
};

export class NativeCallEngine {
  private socket: Socket;
  private sessionId: string;
  private fromUser: CallParticipant;
  private toUser: CallParticipant;
  private role: SessionRole;
  private iceServers?: IceServer[];
  private speakerphoneOn: boolean;
  private events: NativeCallEngineEvents;

  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteTrackIds = new Set<string>();
  private connectionState: string = "new";
  /**
   * Stable id we attach to every emit so the backend logs it as `peerId`. We
   * never *dial* it (no PeerJS), but logs are easier to grep when both clients
   * carry a unique handle.
   */
  private peerId: string;
  private status: CallEngineStatus = "idle";
  private bothJoinedFired = false;
  private remoteJoined = false;
  private pendingRemoteIce: RTCIceCandidateInit[] = [];
  private socketBindings: Array<() => void> = [];
  private disposed = false;
  private offerInFlight = false;
  private lastHandledJoinPeerId: string | null = null;
  private networkTier: LessonNetworkTier = "normal";
  private startWithCameraOff = false;
  private iceDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private usingRelay = false;

  constructor(cfg: NativeCallEngineConfig, events: NativeCallEngineEvents = {}) {
    this.socket = cfg.socket;
    this.sessionId = cfg.sessionId;
    this.fromUser = cfg.fromUser;
    this.toUser = cfg.toUser;
    this.role = cfg.role;
    this.iceServers = cfg.iceServers;
    this.speakerphoneOn = cfg.speakerphoneOn ?? true;
    this.startWithCameraOff = !!cfg.startWithCameraOff;
    this.events = events;
    this.peerId = `${cfg.fromUser._id}_${cfg.sessionId}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.disposed) throw new Error("Engine already disposed");
    if (!isWebRTCModuleLinked()) {
      throw new Error(
        "Native video calling is unavailable in this build. Reinstall the NetQwix app from TestFlight or the store."
      );
    }
    this.setStatus("preparing");

    try {
      this.attachAudioRouting();
      await this.acquireLocalStream(this.networkTier);
      if (this.startWithCameraOff) {
        this.setCameraEnabled(false);
      }
      this.buildPeerConnection();
      this.attachSocketHandlers();
      this.emitJoin();
      this.setStatus("joining");
    } catch (err) {
      this.events.onError?.(err as Error);
      this.setStatus("failed");
      throw err;
    }
  }

  /** Toggle the local microphone. Emits MUTE_ME so the remote UI updates. */
  setMicEnabled(enabled: boolean): boolean {
    if (!this.localStream) return false;
    this.localStream.getAudioTracks().forEach((t: MediaStreamTrack) => {
      t.enabled = enabled;
    });
    const isMuted = !enabled;
    this.socket.emit(CALL_EVENTS.MUTE_ME, {
      isMuted,
      muteStatus: isMuted,
      userInfo: this.buildUserInfo(),
    });
    return enabled;
  }

  /** Toggle the local camera. Emits STOP_FEED so the remote UI hides the tile. */
  setCameraEnabled(enabled: boolean): boolean {
    if (!this.localStream) return false;
    this.localStream.getVideoTracks().forEach((t: MediaStreamTrack) => {
      t.enabled = enabled;
    });
    this.socket.emit(CALL_EVENTS.STOP_FEED, {
      feedStatus: enabled,
      userInfo: this.buildUserInfo(),
    });
    return enabled;
  }

  /**
   * Swap between the front and rear cameras. `react-native-webrtc` exposes a
   * non-standard `_switchCamera()` method on the live video track.
   */
  /** Apply Meet-style encoder / resolution limits for the current network tier. */
  setNetworkAdaptation(tier: LessonNetworkTier): void {
    if (this.disposed) return;
    this.networkTier = tier;
    void this.applyVideoAdaptation(tier);
  }

  getNetworkTier(): LessonNetworkTier {
    return this.networkTier;
  }

  isUsingRelay(): boolean {
    return this.usingRelay;
  }

  switchCamera(): void {
    if (!this.localStream) return;
    const track = this.localStream.getVideoTracks()[0] as
      | (MediaStreamTrack & { _switchCamera?: () => void })
      | undefined;
    try {
      track?._switchCamera?.();
    } catch (err) {
      this.events.onError?.(err as Error);
    }
  }

  /**
   * End the call locally — close the peer connection, tracks, and tell the
   * other side via the same `close` socket event the web emits.
   */
  endCall(): void {
    if (this.disposed) return;
    try {
      this.socket.emit(LESSON_SOCKET_EVENTS.END_EARLY_REQUEST, {
        sessionId: this.sessionId,
      });
      this.socket.emit(CALL_EVENTS.ON_CLOSE, {
        userInfo: this.buildUserInfo(),
      });
    } catch {
      /* socket may already be gone */
    }
    this.dispose();
    this.events.onClose?.();
  }

  /**
   * Tear down all native resources. Idempotent.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.setStatus("ended");
    this.clearIceDisconnectTimer();

    this.socketBindings.forEach((off) => off());
    this.socketBindings = [];

    try {
      this.pc?.close();
    } catch {
      /* noop */
    }
    this.pc = null;

    try {
      this.localStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    } catch {
      /* noop */
    }
    this.localStream = null;
    this.remoteStream = null;
    this.remoteTrackIds.clear();

    try {
      InCallManager.stop();
    } catch {
      /* noop */
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private attachAudioRouting() {
    try {
      InCallManager.start({ media: "video" });
      InCallManager.setSpeakerphoneOn(this.speakerphoneOn);
      InCallManager.setKeepScreenOn(true);
    } catch (err) {
      log("InCallManager start failed", err);
    }
  }

  private videoConstraintsForTier(tier: LessonNetworkTier) {
    const cfg = LESSON_NETWORK_TIER_CONFIG[tier];
    return {
      facingMode: "user" as const,
      width: { ideal: cfg.videoWidth },
      height: { ideal: cfg.videoHeight },
      frameRate: { ideal: cfg.maxFps, max: cfg.maxFps },
    };
  }

  private async acquireLocalStream(tier: LessonNetworkTier = "normal") {
    const stream = (await mediaDevices.getUserMedia({
      audio: true,
      video: this.videoConstraintsForTier(tier),
    })) as unknown as MediaStream;
    this.localStream = stream;
    this.events.onLocalStream?.(stream);
  }

  private async applyVideoAdaptation(tier: LessonNetworkTier) {
    const cfg = LESSON_NETWORK_TIER_CONFIG[tier];
    const track = this.localStream?.getVideoTracks()[0] as
      | (MediaStreamTrack & {
          applyConstraints?: (c: object) => Promise<void>;
        })
      | undefined;
    if (track?.applyConstraints) {
      try {
        await track.applyConstraints(this.videoConstraintsForTier(tier));
      } catch (err) {
        log("applyConstraints failed", err);
      }
    }
    await this.applySenderBitrateCap(cfg.maxVideoBitrate);
  }

  private async applySenderBitrateCap(maxBitrate: number) {
    const pc = this.pc as RTCPeerConnection | null;
    if (!pc?.getSenders) return;
    try {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === "video");
      if (!videoSender?.getParameters || !videoSender.setParameters) return;
      const params = videoSender.getParameters();
      if (!params.encodings?.length) {
        params.encodings = [{ active: true }];
      }
      params.encodings = params.encodings.map((enc, i) => {
        if (maxBitrate <= 0 || i !== 0) return enc;
        return { ...enc, maxBitrate };
      });
      await videoSender.setParameters(params);
    } catch (err) {
      log("setParameters bitrate failed", err);
    }
  }

  private clearIceDisconnectTimer() {
    if (this.iceDisconnectTimer) {
      clearTimeout(this.iceDisconnectTimer);
      this.iceDisconnectTimer = null;
    }
  }

  private scheduleIceRecovery() {
    this.clearIceDisconnectTimer();
    const ms = LESSON_NETWORK_TIER_CONFIG[this.networkTier].iceRecoveryMs;
    this.iceDisconnectTimer = setTimeout(() => {
      this.iceDisconnectTimer = null;
      const ice = (this.pc as any)?.iceConnectionState as string | undefined;
      if (
        !this.disposed &&
        (ice === "disconnected" || ice === "failed")
      ) {
        log("ICE recovery — reconnecting peer after sustained disconnect");
        this.reconnectPeer();
      }
    }, ms);
  }

  private buildPeerConnection() {
    const config = buildIceConfig(this.iceServers);
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({
        iceServers: config.iceServers as any,
      });
    } catch (err) {
      log("PeerConnection init failed — retrying with STUN-only defaults", err);
      const fallback = sanitizeIceServers(DEFAULT_ICE_SERVERS);
      this.iceServers = fallback;
      try {
        pc = new RTCPeerConnection({
          iceServers: fallback as any,
        });
      } catch (retryErr) {
        const message =
          retryErr instanceof Error ? retryErr.message : "Failed to initialize PeerConnection.";
        throw new Error(`${message} Check that you are on a production/dev build with WebRTC enabled.`);
      }
    }
    this.pc = pc;

    this.localStream?.getTracks().forEach((track: MediaStreamTrack) => {
      pc.addTrack(track, this.localStream as MediaStream);
    });

    /**
     * react-native-webrtc fires `ontrack` per track (often separate audio/video).
     * Merge into one persistent MediaStream so we never drop the video track when
     * the audio track arrives second.
     */
    (pc as any).ontrack = (event: any) => {
      const track: MediaStreamTrack | undefined = event?.track;
      if (!track) return;

      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      if (!this.remoteTrackIds.has(track.id)) {
        try {
          if (this.remoteStream) {
            const sameKind = this.remoteStream
              .getTracks()
              .filter((t) => t.kind === track.kind && t.readyState === "ended");
            for (const ended of sameKind) {
              try {
                this.remoteStream.removeTrack(ended);
                this.remoteTrackIds.delete(ended.id);
              } catch {
                /* ignore */
              }
            }
          } else {
            this.remoteStream = new MediaStream();
          }
          this.remoteStream.addTrack(track);
          this.remoteTrackIds.add(track.id);
        } catch (err) {
          log("addTrack failed", err);
        }
      }

      (track as any).onended = () => {
        this.remoteTrackIds.delete(track.id);
      };

      log("ontrack", {
        kind: track.kind,
        trackCount: this.remoteStream.getTracks().length,
      });

      this.events.onRemoteStream?.(this.remoteStream);

      if (this.remoteStream.getVideoTracks().length > 0) {
        if (!this.bothJoinedFired) {
          this.bothJoinedFired = true;
          this.events.onBothJoined?.();
        }
        if (this.status === "reconnecting") {
          this.setStatus("connected");
        }
      }
    };

    (pc as any).onicecandidate = (event: any) => {
      if (!event?.candidate) return;
      const candidate: RTCIceCandidateInit = event.candidate.toJSON
        ? event.candidate.toJSON()
        : event.candidate;
      this.socket.emit(CALL_EVENTS.ON_ICE_CANDIDATE, {
        candidate,
        userInfo: this.buildUserInfo(),
      });
    };

    (pc as any).onconnectionstatechange = () => {
      const state = (pc as any).connectionState as string;
      this.connectionState = state;
      log("connectionState", state);
      if (state === "connected") {
        this.clearIceDisconnectTimer();
        this.setStatus("connected");
        void this.applyVideoAdaptation(this.networkTier);
      } else if (state === "connecting") this.setStatus("connecting");
      else if (state === "disconnected" || state === "failed") {
        this.setStatus("reconnecting");
        this.scheduleIceRecovery();
      } else if (state === "closed" && !this.disposed) {
        this.setStatus("reconnecting");
        this.scheduleIceRecovery();
      }
    };

    (pc as any).oniceconnectionstatechange = () => {
      const ice = (pc as any).iceConnectionState as string | undefined;
      if (ice === "connected" || ice === "completed") {
        this.clearIceDisconnectTimer();
      } else if (ice === "disconnected" || ice === "failed") {
        this.scheduleIceRecovery();
      }
    };
  }

  private attachSocketHandlers() {
    const socket = this.socket;

    const offCallJoin = (payload: { userInfo?: any }) => {
      const ui = payload?.userInfo || {};
      if (String(ui?.from_user) !== String(this.toUser._id)) return;

      const joinPeerId =
        ui.peerId != null && String(ui.peerId).trim() !== ""
          ? String(ui.peerId).trim()
          : null;
      if (joinPeerId && joinPeerId === this.lastHandledJoinPeerId) {
        return;
      }
      if (joinPeerId) this.lastHandledJoinPeerId = joinPeerId;

      log("ON_CALL_JOIN received from peer", ui);
      const wasReconnecting = this.status === "reconnecting";
      this.remoteJoined = true;
      if (wasReconnecting && this.localStream) {
        try {
          this.pc?.close();
        } catch {
          /* noop */
        }
        this.pc = null;
        this.pendingRemoteIce = [];
        this.offerInFlight = false;
        this.buildPeerConnection();
        this.setStatus("connecting");
      }
      this.events.onPeerJoined?.({
        from_user: ui.from_user,
        to_user: ui.to_user,
        sessionId: ui.sessionId ?? this.sessionId,
        peerId: ui.peerId,
      });

      /** Deterministic offerer avoids mobile↔mobile glare (both sides used to send offers). */
      if (this.shouldInitiateOffer() && this.pc && !this.pc.localDescription) {
        void this.createAndSendOffer();
      }
    };

    const onBothJoin = () => {
      if (!this.bothJoinedFired) {
        this.bothJoinedFired = true;
        this.events.onBothJoined?.();
      }
    };

    const onOffer = async (payload: any) => {
      const offer: RTCSessionDescriptionInit | undefined =
        payload?.offer ?? (payload?.type ? payload : undefined);
      if (!offer || !this.pc) return;
      const pc = this.pc;
      if (pc.signalingState === "have-local-offer") {
        return;
      }
      if (pc.remoteDescription) return;
      try {
        await pc.setRemoteDescription(
          new RTCSessionDescription(offer as any)
        );
        await this.drainPendingIce();
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        socket.emit(CALL_EVENTS.ON_ANSWER, {
          answer,
          userInfo: this.buildUserInfo(),
        });
      } catch (err) {
        this.events.onError?.(err as Error);
      }
    };

    const onAnswer = async (payload: any) => {
      const answer: RTCSessionDescriptionInit | undefined =
        payload?.answer ?? (payload?.type ? payload : undefined);
      if (!answer || !this.pc) return;
      if (this.pc.signalingState !== "have-local-offer") return;
      try {
        await this.pc.setRemoteDescription(
          new RTCSessionDescription(answer as any)
        );
        await this.drainPendingIce();
      } catch (err) {
        this.events.onError?.(err as Error);
      }
    };

    const onIce = async (payload: any) => {
      const candidate: RTCIceCandidateInit | undefined =
        payload?.candidate ?? (payload?.sdpMid ? payload : undefined);
      if (!candidate || !this.pc) return;
      if (!this.pc.remoteDescription) {
        // Remote description not set yet — buffer.
        this.pendingRemoteIce.push(candidate);
        return;
      }
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate as any));
      } catch (err) {
        this.events.onError?.(err as Error);
      }
    };

    const onMute = (payload: any) => {
      const muted =
        typeof payload?.isMuted === "boolean"
          ? payload.isMuted
          : typeof payload?.muteStatus === "boolean"
            ? payload.muteStatus
            : false;
      this.events.onRemoteMute?.(muted);
    };

    const onStopFeed = (payload: any) => {
      this.events.onRemoteStopFeed?.(!!payload?.feedStatus);
    };

    const onClose = () => {
      /** Remote peer tapped End — tear down for both sides. */
      this.events.onPeerLeft?.();
      this.events.onClose?.();
      this.dispose();
    };

    const onCallLeave = (payload: { userId?: string; sessionId?: string }) => {
      if (
        payload?.sessionId != null &&
        String(payload.sessionId) !== String(this.sessionId)
      ) {
        return;
      }
      if (payload?.userId != null && String(payload.userId) !== String(this.toUser._id)) {
        return;
      }
      this.handlePartnerDisconnected();
    };

    const onCallEnd = () => {
      this.events.onPeerLeft?.();
      this.events.onClose?.();
      this.dispose();
    };

    const onJoinDenied = (payload: {
      sessionId?: string;
      reason?: string;
      message?: string;
      canTakeOver?: boolean;
    }) => {
      if (
        payload?.sessionId != null &&
        String(payload.sessionId) !== String(this.sessionId)
      ) {
        return;
      }
      log("CALL_JOIN_DENIED", payload);
      this.events.onJoinDenied?.(payload);
      if (payload?.canTakeOver) {
        return;
      }
      this.events.onError?.(
        new Error(
          payload?.message ??
            "This lesson is already active on another device."
        )
      );
      this.dispose();
    };

    const onSlotTakenOver = (payload: {
      sessionId?: string;
      message?: string;
    }) => {
      if (
        payload?.sessionId != null &&
        String(payload.sessionId) !== String(this.sessionId)
      ) {
        return;
      }
      log("CALL_SLOT_TAKEN_OVER", payload);
      this.events.onSlotTakenOver?.(payload);
      this.events.onError?.(
        new Error(
          payload?.message ??
            "This lesson was continued on another device."
        )
      );
      this.dispose();
    };

    socket.on(CALL_EVENTS.ON_CALL_JOIN, offCallJoin);
    socket.on(CALL_EVENTS.CALL_JOIN_DENIED, onJoinDenied);
    socket.on(CALL_EVENTS.CALL_SLOT_TAKEN_OVER, onSlotTakenOver);
    socket.on(CALL_EVENTS.ON_BOTH_JOIN, onBothJoin);
    socket.on(CALL_EVENTS.ON_OFFER, onOffer);
    socket.on(CALL_EVENTS.ON_ANSWER, onAnswer);
    socket.on(CALL_EVENTS.ON_ICE_CANDIDATE, onIce);
    socket.on(CALL_EVENTS.MUTE_ME, onMute);
    socket.on(CALL_EVENTS.STOP_FEED, onStopFeed);
    socket.on(CALL_EVENTS.ON_CLOSE, onClose);
    socket.on(CALL_EVENTS.ON_CALL_LEAVE, onCallLeave);
    socket.on(CALL_EVENTS.CALL_END, onCallEnd);

    this.socketBindings.push(() =>
      socket.off(CALL_EVENTS.ON_CALL_JOIN, offCallJoin)
    );
    this.socketBindings.push(() =>
      socket.off(CALL_EVENTS.CALL_JOIN_DENIED, onJoinDenied)
    );
    this.socketBindings.push(() =>
      socket.off(CALL_EVENTS.CALL_SLOT_TAKEN_OVER, onSlotTakenOver)
    );
    this.socketBindings.push(() =>
      socket.off(CALL_EVENTS.ON_BOTH_JOIN, onBothJoin)
    );
    this.socketBindings.push(() => socket.off(CALL_EVENTS.ON_OFFER, onOffer));
    this.socketBindings.push(() => socket.off(CALL_EVENTS.ON_ANSWER, onAnswer));
    this.socketBindings.push(() =>
      socket.off(CALL_EVENTS.ON_ICE_CANDIDATE, onIce)
    );
    this.socketBindings.push(() => socket.off(CALL_EVENTS.MUTE_ME, onMute));
    this.socketBindings.push(() =>
      socket.off(CALL_EVENTS.STOP_FEED, onStopFeed)
    );
    this.socketBindings.push(() => socket.off(CALL_EVENTS.ON_CLOSE, onClose));
    this.socketBindings.push(() =>
      socket.off(CALL_EVENTS.ON_CALL_LEAVE, onCallLeave)
    );
    this.socketBindings.push(() => socket.off(CALL_EVENTS.CALL_END, onCallEnd));
  }

  /** Partner disconnected from session room — keep local media; allow re-offer on rejoin. */
  private handlePartnerDisconnected(): void {
    if (this.disposed) return;
    this.remoteJoined = false;
    this.remoteStream = null;
    this.remoteTrackIds.clear();
    this.pendingRemoteIce = [];
    this.events.onRemoteStream?.(null);
    this.setStatus("reconnecting");
    this.events.onPeerDisconnected?.();
  }

  /** Re-announce presence on socket (re)connect without tearing down WebRTC. */
  rejoinSignal(): void {
    if (this.disposed) return;
    const st = this.status;
    if (st === "idle" || st === "ended" || st === "preparing") return;
    this.emitJoin();
  }

  /** Apply fresh TURN/STUN credentials before rebuilding the peer connection. */
  updateIceServers(servers?: IceServer[]): void {
    if (servers?.length) this.iceServers = servers;
  }

  /** Rebuild WebRTC after partner returns (optional — also handled on ON_CALL_JOIN). */
  reconnectPeer(): void {
    if (this.disposed) return;
    try {
      this.pc?.close();
    } catch {
      /* noop */
    }
    this.pc = null;
    this.remoteTrackIds.clear();
    this.pendingRemoteIce = [];
    this.offerInFlight = false;
    this.lastHandledJoinPeerId = null;
    this.bothJoinedFired = false;
    this.remoteJoined = false;
    if (this.localStream) {
      this.buildPeerConnection();
      void this.applyVideoAdaptation(this.networkTier);
      this.emitJoin();
      this.setStatus("reconnecting");
    }
    /** Keep last frame visible until ontrack delivers fresh media (avoid blank partner tile). */
  }

  private async drainPendingIce() {
    if (!this.pc) return;
    const pending = this.pendingRemoteIce.splice(0);
    for (const candidate of pending) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate as any));
      } catch (err) {
        log("drain ICE failed", err);
      }
    }
  }

  private async createAndSendOffer() {
    if (!this.pc || this.disposed || this.offerInFlight) return;
    const pc = this.pc;
    if (pc.localDescription) return;

    this.offerInFlight = true;
    try {
      const offer = await pc.createOffer({});
      if (this.disposed || this.pc !== pc) return;
      await pc.setLocalDescription(offer);
      if (this.disposed || this.pc !== pc) return;
      this.socket.emit(CALL_EVENTS.ON_OFFER, {
        offer,
        userInfo: this.buildUserInfo(),
      });
    } catch (err) {
      this.events.onError?.(err as Error);
    } finally {
      this.offerInFlight = false;
    }
  }

  private emitJoin() {
    const userInfo = this.buildUserInfo();
    const send = () => {
      log("emitting ON_CALL_JOIN", userInfo);
      this.socket.emit(CALL_EVENTS.ON_CALL_JOIN, { userInfo });
    };
    if (this.socket.connected) {
      send();
    } else {
      this.socket.once("connect", send);
    }
  }

  /** Displace the other device and re-run the join handshake on this socket. */
  requestTakeover(): void {
    if (this.disposed) return;
    const userInfo = this.buildUserInfo();
    const send = () => {
      log("emitting CALL_JOIN_TAKEOVER", userInfo);
      this.socket.emit(CALL_EVENTS.CALL_JOIN_TAKEOVER, { userInfo });
    };
    if (this.socket.connected) {
      send();
    } else {
      this.socket.once("connect", send);
    }
  }

  private buildUserInfo() {
    return {
      from_user: this.fromUser._id,
      to_user: this.toUser._id,
      sessionId: this.sessionId,
      peerId: this.peerId,
      /** Web skips PeerJS `peer.call` and uses ON_OFFER/ON_ANSWER when set. */
      signalingMode: "socket-webrtc" as const,
    };
  }

  /** Lower Mongo id offers first — stable across trainer/trainee and iOS/Android. */
  private shouldInitiateOffer(): boolean {
    return String(this.fromUser._id).localeCompare(String(this.toUser._id)) < 0;
  }

  private setStatus(status: CallEngineStatus) {
    if (this.status === status) return;
    this.status = status;
    if (status === "failed" || status === "reconnecting") {
      reportOpsEvent({
        event_type: "CLIENT_CALL_ERROR",
        category: "call",
        severity: status === "failed" ? "error" : "warning",
        session_id: this.sessionId,
        title: `Native call ${status}`,
        summary: `Call engine entered ${status}`,
        payload: {
          engineStatus: status,
          iceConnectionState: this.pc?.iceConnectionState ?? "unknown",
          signalingState: this.pc?.signalingState ?? "unknown",
        },
        correlation_id: this.sessionId,
      });
    }
    this.events.onStatus?.(status);
  }

  // ── Public read-only state ────────────────────────────────────────────────

  getStatus(): CallEngineStatus {
    return this.status;
  }
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
  hasRemoteJoined(): boolean {
    return this.remoteJoined;
  }

  getConnectionDiagnostics(): {
    connectionState: string;
    remoteAudioTracks: number;
    remoteVideoTracks: number;
    iceConnectionState: string;
  } {
    const ice = (this.pc as any)?.iceConnectionState as string | undefined;
    return {
      connectionState: this.connectionState,
      remoteAudioTracks: this.remoteStream?.getAudioTracks().length ?? 0,
      remoteVideoTracks: this.remoteStream?.getVideoTracks().length ?? 0,
      iceConnectionState: ice ?? "unknown",
    };
  }

  /**
   * Aggregate WebRTC stats into a small set of numbers the UI uses for
   * the connection-quality pill. We collapse the verbose RTCStatsReport
   * down to RTT, jitter, and packet-loss percent — enough to decide
   * red/yellow/green without bloating the consumer.
   *
   * `getStats()` is async; the UI calls this on a ~2 s interval.
   */
  async getRealtimeNetworkStats(): Promise<{
    rttMs: number | null;
    jitterMs: number | null;
    packetLossPct: number | null;
    iceConnectionState: string;
    usingRelay: boolean;
  }> {
    const pc = this.pc as any;
    if (!pc?.getStats) {
      return {
        rttMs: null,
        jitterMs: null,
        packetLossPct: null,
        iceConnectionState: "unknown",
        usingRelay: this.usingRelay,
      };
    }
    try {
      const report = await pc.getStats();
      let rttMs: number | null = null;
      let jitterMs: number | null = null;
      let packetsLost = 0;
      let packetsReceived = 0;

      let relayLocal = false;
      let relayRemote = false;

      report.forEach((stat: any) => {
        if (!stat) return;
        if (
          stat.type === "local-candidate" &&
          String(stat.candidateType || stat.type) === "relay"
        ) {
          relayLocal = true;
        }
        if (
          stat.type === "remote-candidate" &&
          String(stat.candidateType || "") === "relay"
        ) {
          relayRemote = true;
        }
        if (
          (stat.type === "candidate-pair" || stat.type === "candidatepair") &&
          stat.nominated &&
          typeof stat.currentRoundTripTime === "number"
        ) {
          rttMs = Math.round(stat.currentRoundTripTime * 1000);
          if (stat.localCandidateType === "relay") relayLocal = true;
          if (stat.remoteCandidateType === "relay") relayRemote = true;
        }
        if (stat.type === "inbound-rtp" && (stat.kind === "audio" || stat.kind === "video")) {
          if (typeof stat.jitter === "number") {
            jitterMs = Math.max(jitterMs ?? 0, Math.round(stat.jitter * 1000));
          }
          if (typeof stat.packetsLost === "number") {
            packetsLost += stat.packetsLost;
          }
          if (typeof stat.packetsReceived === "number") {
            packetsReceived += stat.packetsReceived;
          }
        }
      });

      const total = packetsLost + packetsReceived;
      const packetLossPct =
        total > 0 ? Math.min(100, (packetsLost / total) * 100) : null;
      const ice = (this.pc as any)?.iceConnectionState as string | undefined;
      this.usingRelay = relayLocal || relayRemote;
      return {
        rttMs,
        jitterMs,
        packetLossPct,
        iceConnectionState: ice ?? "unknown",
        usingRelay: this.usingRelay,
      };
    } catch {
      return {
        rttMs: null,
        jitterMs: null,
        packetLossPct: null,
        iceConnectionState: "unknown",
        usingRelay: this.usingRelay,
      };
    }
  }
}
