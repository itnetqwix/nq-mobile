import { useEffect, useRef } from "react";
import { useSocket } from "../socket/SocketContext";
import { CALL_EVENTS } from "./callEvents";

/**
 * Identity stanza that EVERY backend video-call event must carry. Backend
 * `socket.service.ts` reads `userInfo.to_user` to route through MemCache and looks
 * up `userInfo.sessionId` / `peerId` for room bookkeeping. See:
 *   `nq-backend-main/src/modules/socket/socket.service.ts → ON_CALL_JOIN handler`
 *   `nq-frontend-main/app/components/video/callEngine.js → emitJoin payload`
 */
export type CallUserInfo = {
  from_user: string;
  to_user: string;
  sessionId: string;
  /**
   * PeerJS peer id on the web. For native (libwebrtc) clients we still send a
   * stable string so the trainer/trainee can see a peerId in the join broadcast,
   * but we never dial it — the SDP exchange happens over `offer`/`answer` socket
   * events instead.
   */
  peerId?: string;
};

type SignalingHandlers = {
  /** Other peer reports they joined the room. */
  onPeerJoined?: (payload: { userInfo: CallUserInfo }) => void;
  /** Server says both peers are joined → trigger SDP exchange. */
  onBothJoined?: (payload: any) => void;
  onOffer?: (payload: { offer?: RTCSessionDescriptionInit; userInfo?: CallUserInfo } & RTCSessionDescriptionInit) => void;
  onAnswer?: (payload: { answer?: RTCSessionDescriptionInit; userInfo?: CallUserInfo } & RTCSessionDescriptionInit) => void;
  onIceCandidate?: (payload: { candidate?: RTCIceCandidateInit; userInfo?: CallUserInfo } & RTCIceCandidateInit) => void;
  onMute?: (payload: { isMuted: boolean; userInfo?: CallUserInfo }) => void;
  onStopFeed?: (payload: { feedStatus: boolean; userInfo?: CallUserInfo }) => void;
  onPeerClosed?: (payload: any) => void;
  /** Server hung up the lesson (timer expired, admin, …). */
  onCallEnd?: (payload: any) => void;
};

type Emitters = {
  /**
   * Web-parity: wraps payload in `{ userInfo: { from_user, to_user, sessionId, peerId } }`
   * exactly like `callEngine.js → emitJoin`.
   */
  joinCall: (userInfo: CallUserInfo) => void;
  sendOffer: (params: { offer: RTCSessionDescriptionInit; userInfo: CallUserInfo }) => void;
  sendAnswer: (params: { answer: RTCSessionDescriptionInit; userInfo: CallUserInfo }) => void;
  sendIceCandidate: (params: {
    candidate: RTCIceCandidateInit;
    userInfo: CallUserInfo;
  }) => void;
  sendMute: (params: { isMuted: boolean; userInfo: CallUserInfo }) => void;
  sendStopFeed: (params: { feedStatus: boolean; userInfo: CallUserInfo }) => void;
  sendClose: (params: { userInfo: CallUserInfo }) => void;
};

/**
 * Centralised socket bindings for the call signaling lifecycle. Listeners are
 * stable across re-renders thanks to a ref, so callers can pass in inline
 * handlers without tearing down/up the socket subscriptions on every render.
 *
 * Emit payloads mirror the web exactly so the backend's relay handlers
 * (`socket.service.ts`) see identical wire shapes from both clients.
 */
export function useCallSignaling(handlers: SignalingHandlers): Emitters {
  const { socket } = useSocket();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!socket) return;

    const onJoin = (p: any) => handlersRef.current.onPeerJoined?.(p);
    const onBoth = (p: any) => handlersRef.current.onBothJoined?.(p);
    const onOffer = (p: any) => handlersRef.current.onOffer?.(p);
    const onAnswer = (p: any) => handlersRef.current.onAnswer?.(p);
    const onIce = (p: any) => handlersRef.current.onIceCandidate?.(p);
    const onMute = (p: any) => handlersRef.current.onMute?.(p);
    const onStopFeed = (p: any) => handlersRef.current.onStopFeed?.(p);
    const onClose = (p: any) => handlersRef.current.onPeerClosed?.(p);
    const onEnd = (p: any) => handlersRef.current.onCallEnd?.(p);

    socket.on(CALL_EVENTS.ON_CALL_JOIN, onJoin);
    socket.on(CALL_EVENTS.ON_BOTH_JOIN, onBoth);
    socket.on(CALL_EVENTS.ON_OFFER, onOffer);
    socket.on(CALL_EVENTS.ON_ANSWER, onAnswer);
    socket.on(CALL_EVENTS.ON_ICE_CANDIDATE, onIce);
    socket.on(CALL_EVENTS.MUTE_ME, onMute);
    socket.on(CALL_EVENTS.STOP_FEED, onStopFeed);
    socket.on(CALL_EVENTS.ON_CLOSE, onClose);
    socket.on(CALL_EVENTS.CALL_END, onEnd);

    return () => {
      socket.off(CALL_EVENTS.ON_CALL_JOIN, onJoin);
      socket.off(CALL_EVENTS.ON_BOTH_JOIN, onBoth);
      socket.off(CALL_EVENTS.ON_OFFER, onOffer);
      socket.off(CALL_EVENTS.ON_ANSWER, onAnswer);
      socket.off(CALL_EVENTS.ON_ICE_CANDIDATE, onIce);
      socket.off(CALL_EVENTS.MUTE_ME, onMute);
      socket.off(CALL_EVENTS.STOP_FEED, onStopFeed);
      socket.off(CALL_EVENTS.ON_CLOSE, onClose);
      socket.off(CALL_EVENTS.CALL_END, onEnd);
    };
  }, [socket]);

  return {
    joinCall: (userInfo) =>
      socket?.emit(CALL_EVENTS.ON_CALL_JOIN, { userInfo }),
    sendOffer: ({ offer, userInfo }) =>
      socket?.emit(CALL_EVENTS.ON_OFFER, { offer, userInfo }),
    sendAnswer: ({ answer, userInfo }) =>
      socket?.emit(CALL_EVENTS.ON_ANSWER, { answer, userInfo }),
    sendIceCandidate: ({ candidate, userInfo }) =>
      socket?.emit(CALL_EVENTS.ON_ICE_CANDIDATE, { candidate, userInfo }),
    sendMute: ({ isMuted, userInfo }) =>
      socket?.emit(CALL_EVENTS.MUTE_ME, { isMuted, userInfo }),
    sendStopFeed: ({ feedStatus, userInfo }) =>
      socket?.emit(CALL_EVENTS.STOP_FEED, { feedStatus, userInfo }),
    sendClose: ({ userInfo }) =>
      socket?.emit(CALL_EVENTS.ON_CLOSE, { userInfo }),
  };
}
