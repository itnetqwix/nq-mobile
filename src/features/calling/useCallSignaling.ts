import { useEffect, useRef } from "react";
import { useSocket } from "../socket/SocketContext";
import { CALL_EVENTS } from "./callEvents";

type SignalingHandlers = {
  /** Other peer reports they joined the room. */
  onPeerJoined?: (payload: any) => void;
  /** Server says both peers are joined → trigger SDP exchange. */
  onBothJoined?: (payload: any) => void;
  onOffer?: (payload: { offer: any; from?: string; peerId?: string }) => void;
  onAnswer?: (payload: { answer: any; from?: string; peerId?: string }) => void;
  onIceCandidate?: (payload: { candidate: any; from?: string; peerId?: string }) => void;
  onMute?: (payload: { isMuted: boolean; userId?: string }) => void;
  onStopFeed?: (payload: { videoOff: boolean; userId?: string }) => void;
  onPeerClosed?: (payload: any) => void;
  /** Server hung up the lesson (timer expired, admin, …). */
  onCallEnd?: (payload: any) => void;
};

type Emitters = {
  joinCall: (payload: { sessionId: string; fromUser: { _id: string }; toUser: { _id: string } }) => void;
  sendOffer: (payload: { sessionId: string; offer: any; peerId?: string }) => void;
  sendAnswer: (payload: { sessionId: string; answer: any; peerId?: string }) => void;
  sendIceCandidate: (payload: { sessionId: string; candidate: any; peerId?: string }) => void;
  sendMute: (payload: { sessionId: string; isMuted: boolean }) => void;
  sendStopFeed: (payload: { sessionId: string; videoOff: boolean }) => void;
  sendClose: (payload: { sessionId: string }) => void;
};

/**
 * Centralised socket bindings for the call signaling lifecycle. Listeners are stable
 * across re-renders thanks to a ref, so callers can pass in inline handlers without
 * tearing down/up the socket subscriptions on every render.
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
    joinCall: (p) => socket?.emit(CALL_EVENTS.ON_CALL_JOIN, p),
    sendOffer: (p) => socket?.emit(CALL_EVENTS.ON_OFFER, p),
    sendAnswer: (p) => socket?.emit(CALL_EVENTS.ON_ANSWER, p),
    sendIceCandidate: (p) => socket?.emit(CALL_EVENTS.ON_ICE_CANDIDATE, p),
    sendMute: (p) => socket?.emit(CALL_EVENTS.MUTE_ME, p),
    sendStopFeed: (p) => socket?.emit(CALL_EVENTS.STOP_FEED, p),
    sendClose: (p) => socket?.emit(CALL_EVENTS.ON_CLOSE, p),
  };
}
