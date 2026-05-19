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
import { reportOpsEvent } from "../ops/opsEventsApi";
import { buildIceConfig } from "./iceServers";
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
  /** Specifically: the remote peer disconnected mid-call (their socket emitted
   *  ON_CLOSE while we were still active). Distinct from `onClose`, which also
   *  fires when the local user ended the call themselves. */
  onPeerLeft?: () => void;
  /** Non-fatal warning. */
  onError?: (err: Error) => void;
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

  constructor(cfg: NativeCallEngineConfig, events: NativeCallEngineEvents = {}) {
    this.socket = cfg.socket;
    this.sessionId = cfg.sessionId;
    this.fromUser = cfg.fromUser;
    this.toUser = cfg.toUser;
    this.role = cfg.role;
    this.iceServers = cfg.iceServers;
    this.speakerphoneOn = cfg.speakerphoneOn ?? true;
    this.events = events;
    this.peerId = `${cfg.fromUser._id}_${cfg.sessionId}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.disposed) throw new Error("Engine already disposed");
    this.setStatus("preparing");

    try {
      this.attachAudioRouting();
      await this.acquireLocalStream();
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
    this.socket.emit(CALL_EVENTS.MUTE_ME, {
      isMuted: !enabled,
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

  private async acquireLocalStream() {
    /**
     * `react-native-webrtc` mediaDevices.getUserMedia is constraint-compatible
     * with the browser spec but its `facingMode` value needs to be a plain
     * string ("user" / "environment"). Mirrors `useUserMedia` flag set in the
     * web `clip-mode.jsx` defaults.
     */
    const stream = (await mediaDevices.getUserMedia({
      audio: true,
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 1280 },
        frameRate: { ideal: 24, max: 30 },
      },
    })) as unknown as MediaStream;
    this.localStream = stream;
    this.events.onLocalStream?.(stream);
  }

  private buildPeerConnection() {
    const config = buildIceConfig(this.iceServers);
    const pc = new RTCPeerConnection({
      iceServers: config.iceServers as any,
    });
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

      if (!this.bothJoinedFired && this.remoteStream.getVideoTracks().length > 0) {
        this.bothJoinedFired = true;
        this.events.onBothJoined?.();
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
      if (state === "connected") this.setStatus("connected");
      else if (state === "connecting") this.setStatus("connecting");
      else if (state === "disconnected" || state === "failed")
        this.setStatus("reconnecting");
      else if (state === "closed" && !this.disposed) {
        this.setStatus("reconnecting");
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
      this.remoteJoined = true;
      this.events.onPeerJoined?.({
        from_user: ui.from_user,
        to_user: ui.to_user,
        sessionId: ui.sessionId ?? this.sessionId,
        peerId: ui.peerId,
      });

      /** Callee (the `to_user` of the join) sends the SDP offer — works for
       *  trainer↔trainee on native and when the web peer uses socket signaling. */
      const weAreCallee = String(ui.to_user) === String(this.fromUser._id);
      if (weAreCallee) {
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
      try {
        await this.pc.setRemoteDescription(
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
      this.events.onRemoteMute?.(!!payload?.isMuted);
    };

    const onStopFeed = (payload: any) => {
      this.events.onRemoteStopFeed?.(!!payload?.feedStatus);
    };

    const onClose = () => {
      /** ON_CLOSE coming over the socket means the remote peer left first;
       *  surface that as a distinct event for UI notifications, then proceed
       *  with the normal teardown. */
      this.events.onPeerLeft?.();
      this.events.onClose?.();
      this.dispose();
    };

    const onCallEnd = () => {
      this.events.onPeerLeft?.();
      this.events.onClose?.();
      this.dispose();
    };

    socket.on(CALL_EVENTS.ON_CALL_JOIN, offCallJoin);
    socket.on(CALL_EVENTS.ON_BOTH_JOIN, onBothJoin);
    socket.on(CALL_EVENTS.ON_OFFER, onOffer);
    socket.on(CALL_EVENTS.ON_ANSWER, onAnswer);
    socket.on(CALL_EVENTS.ON_ICE_CANDIDATE, onIce);
    socket.on(CALL_EVENTS.MUTE_ME, onMute);
    socket.on(CALL_EVENTS.STOP_FEED, onStopFeed);
    socket.on(CALL_EVENTS.ON_CLOSE, onClose);
    socket.on(CALL_EVENTS.CALL_END, onCallEnd);

    this.socketBindings.push(() =>
      socket.off(CALL_EVENTS.ON_CALL_JOIN, offCallJoin)
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
    this.socketBindings.push(() => socket.off(CALL_EVENTS.CALL_END, onCallEnd));
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
}
