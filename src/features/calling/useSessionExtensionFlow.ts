/**
 * useSessionExtensionFlow
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for the paid session extension UX during a live
 * lesson. Owns the state machine, REST calls (request / cancel / pay /
 * confirm), and the SESSION_EXTENSION_* socket subscriptions so both the
 * trainee modal and trainer approval modal can read from / drive the same hook.
 *
 * State machine
 *   idle                  no request in flight
 *   requesting            trainee POST'd /request, awaiting server ack
 *   awaiting_trainer      pending row exists; waiting on trainer response
 *   awaiting_payment      trainer accepted; trainee can start payment
 *   paying                trainee is mid-payment (sheet open, server confirm)
 *   applied               extension applied -- modal can dismiss
 *   rejected/cancelled/expired/error  -- terminal, surface message and reset
 *
 * Socket events handled
 *   SESSION_EXTENSION_REQUESTED   show trainer modal / sync trainee state
 *   SESSION_EXTENSION_ACCEPTED    flip trainee to "awaiting_payment"
 *   SESSION_EXTENSION_REJECTED    terminal, show toast
 *   SESSION_EXTENSION_CANCELLED   terminal, mirror UI
 *   SESSION_EXTENSION_EXPIRED     terminal, "no response in time"
 *   SESSION_EXTENSION_APPLIED     terminal success
 *
 * Edge cases
 *   - Socket reconnect: LESSON_STATE_SYNC carries pendingExtensionRequest
 *     which we mirror here so the UI rehydrates after backgrounding.
 *   - Payment sheet dismissed: hook explicitly POSTs /cancel-request so the
 *     server resumes the timer without waiting for the auto-expire.
 *   - Wallet path: never goes through Stripe; jumps straight to /confirm.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Alert } from "react-native";

import {
  cancelExtensionRequest,
  confirmSessionExtension,
  createSessionExtensionPaymentIntent,
  fetchSessionExtensionQuote,
  requestSessionExtension,
  respondToExtensionRequest,
  type ExtensionRequestSnapshot,
} from "./sessionExtensionApi";
import { fetchWalletBalance } from "../wallet/walletApi";
import { shouldCancelExtensionOnPaymentFailure } from "./extensionPaymentRecoverability";
import { useStripe } from "@stripe/stripe-react-native";
import type { PendingExtensionRequestSnapshot } from "./useLessonTimer";

const EXTENSION_EVENTS = {
  REQUESTED: "SESSION_EXTENSION_REQUESTED",
  ACCEPTED: "SESSION_EXTENSION_ACCEPTED",
  REJECTED: "SESSION_EXTENSION_REJECTED",
  CANCELLED: "SESSION_EXTENSION_CANCELLED",
  EXPIRED: "SESSION_EXTENSION_EXPIRED",
  PAYMENT_STARTED: "SESSION_EXTENSION_PAYMENT_STARTED",
  APPLIED: "SESSION_EXTENSION_APPLIED",
} as const;

export type ExtensionPhase =
  | "idle"
  | "requesting"
  | "awaiting_trainer"
  | "awaiting_payment"
  | "paying"
  | "applied"
  | "rejected"
  | "cancelled"
  | "expired"
  | "error";

export type ExtensionFlowState = {
  phase: ExtensionPhase;
  /** Active request snapshot (server side of truth). */
  request: ExtensionRequestSnapshot | null;
  /** Last user-facing error / terminal reason. */
  message: string | null;
};

const initialState: ExtensionFlowState = {
  phase: "idle",
  request: null,
  message: null,
};

type Args = {
  socket: Socket | null;
  sessionId: string;
  isTrainer: boolean;
  myUserId: string;
  /** Snapshot pushed via `LESSON_STATE_SYNC` — used to rehydrate after a
   *  reconnect so the trainee's "awaiting trainer" modal can re-open. */
  pendingFromSync: PendingExtensionRequestSnapshot | null;
};

export type UseSessionExtensionFlow = ReturnType<typeof useSessionExtensionFlow>;

export function useSessionExtensionFlow({
  socket,
  sessionId,
  isTrainer,
  myUserId,
  pendingFromSync,
}: Args) {
  const [state, setState] = useState<ExtensionFlowState>(initialState);
  /** Mirror of the latest request id we know about, so socket events that
   *  arrive after a teardown (e.g. user backed out) still update state without
   *  flickering through `idle`. */
  const lastRequestIdRef = useRef<string | null>(null);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const reset = useCallback(() => {
    lastRequestIdRef.current = null;
    setState(initialState);
  }, []);

  /** Map a server-side snapshot into the right local phase. */
  const phaseFromRequest = useCallback(
    (req: ExtensionRequestSnapshot, paying = false): ExtensionPhase => {
      switch (req.status) {
        case "pending":
          return isTrainer ? "awaiting_trainer" : "awaiting_trainer";
        case "accepted":
          return paying ? "paying" : "awaiting_payment";
        case "paid":
          return "applied";
        case "rejected":
          return "rejected";
        case "cancelled":
          return "cancelled";
        case "expired":
          return "expired";
        default:
          return "idle";
      }
    },
    [isTrainer]
  );

  /** Rehydrate from LESSON_STATE_SYNC after a reconnect / late mount. */
  useEffect(() => {
    if (!pendingFromSync) {
      if (
        state.phase === "awaiting_trainer" ||
        state.phase === "awaiting_payment"
      ) {
        if (!lastRequestIdRef.current) {
          reset();
        }
      }
      return;
    }
    if (state.request?.requestId === pendingFromSync.requestId) {
      // Keep paying state if we're mid-payment; the server doesn't know yet.
      if (state.phase === "paying") return;
      setState((prev) => ({
        ...prev,
        request: pendingFromSync as ExtensionRequestSnapshot,
        phase: phaseFromRequest(pendingFromSync as ExtensionRequestSnapshot),
      }));
      return;
    }
    lastRequestIdRef.current = pendingFromSync.requestId;
    setState({
      phase: phaseFromRequest(pendingFromSync as ExtensionRequestSnapshot),
      request: pendingFromSync as ExtensionRequestSnapshot,
      message: null,
    });
  }, [pendingFromSync, phaseFromRequest, reset, state.phase, state.request?.requestId]);

  useEffect(() => {
    if (!socket || !sessionId) return;
    const sameSession = (payload: any) =>
      payload && String(payload.sessionId) === String(sessionId);

    const handleRequested = (payload: any) => {
      if (!sameSession(payload)) return;
      const req = payload?.request as ExtensionRequestSnapshot | undefined;
      if (!req) return;
      lastRequestIdRef.current = req.requestId;
      setState({
        phase: phaseFromRequest(req),
        request: req,
        message: null,
      });
    };

    const handleAccepted = (payload: any) => {
      if (!sameSession(payload)) return;
      const req = payload?.request as ExtensionRequestSnapshot | undefined;
      if (!req) return;
      lastRequestIdRef.current = req.requestId;
      setState((prev) => ({
        ...prev,
        phase: prev.phase === "paying" ? "paying" : "awaiting_payment",
        request: req,
        message: null,
      }));
    };

    const handleTerminal = (payload: any, phase: ExtensionPhase, defaultMsg: string) => {
      if (!sameSession(payload)) return;
      const reqId = payload?.requestId ?? payload?.request?.requestId;
      const tracking = lastRequestIdRef.current;
      if (tracking && reqId && String(tracking) !== String(reqId)) return;
      setState((prev) => ({
        phase,
        request: prev.request,
        message: payload?.reason ?? defaultMsg,
      }));
    };

    const handleRejected = (p: any) =>
      handleTerminal(p, "rejected", "Trainer declined the extension.");
    const handleCancelled = (p: any) =>
      handleTerminal(p, "cancelled", "Extension was cancelled.");
    const handleExpired = (p: any) =>
      handleTerminal(p, "expired", "Extension request expired.");
    const handleApplied = (payload: any) => {
      if (!sameSession(payload)) return;
      setState({ phase: "applied", request: null, message: null });
      lastRequestIdRef.current = null;
    };

    socket.on(EXTENSION_EVENTS.REQUESTED, handleRequested);
    socket.on(EXTENSION_EVENTS.ACCEPTED, handleAccepted);
    socket.on(EXTENSION_EVENTS.REJECTED, handleRejected);
    socket.on(EXTENSION_EVENTS.CANCELLED, handleCancelled);
    socket.on(EXTENSION_EVENTS.EXPIRED, handleExpired);
    socket.on(EXTENSION_EVENTS.APPLIED, handleApplied);

    return () => {
      socket.off(EXTENSION_EVENTS.REQUESTED, handleRequested);
      socket.off(EXTENSION_EVENTS.ACCEPTED, handleAccepted);
      socket.off(EXTENSION_EVENTS.REJECTED, handleRejected);
      socket.off(EXTENSION_EVENTS.CANCELLED, handleCancelled);
      socket.off(EXTENSION_EVENTS.EXPIRED, handleExpired);
      socket.off(EXTENSION_EVENTS.APPLIED, handleApplied);
    };
  }, [socket, sessionId, phaseFromRequest]);

  /** Trainee initiates a request. Returns the server snapshot on success. */
  const requestExtension = useCallback(
    async (minutes: number) => {
      if (isTrainer) return null;
      setState((prev) => ({ ...prev, phase: "requesting", message: null }));
      try {
        const res = await requestSessionExtension({ sessionId, minutes });
        if (res?.request) {
          lastRequestIdRef.current = res.request.requestId;
          const phase = phaseFromRequest(res.request);
          setState({
            phase,
            request: res.request,
            message:
              res.allowed === false && phase === "idle"
                ? res.reason ?? "Extension already in progress."
                : res.allowed === false
                  ? res.reason ?? null
                  : null,
          });
          return res.request;
        }
        if (res?.allowed === false) {
          setState((prev) => ({
            ...prev,
            phase: "error",
            message: res.reason ?? "Extension already in progress.",
          }));
        }
        return null;
      } catch (e: any) {
        const msg =
          e?.response?.data?.error ?? e?.message ?? "Could not start extension.";
        setState((prev) => ({ ...prev, phase: "error", message: msg }));
        return null;
      }
    },
    [isTrainer, sessionId, phaseFromRequest]
  );

  /** Trainer accepts a pending request. */
  const acceptRequest = useCallback(
    async (requestId: string) => {
      if (!isTrainer) return;
      try {
        await respondToExtensionRequest({
          sessionId,
          requestId,
          decision: "accept",
        });
      } catch (e: any) {
        const msg =
          e?.response?.data?.error ?? e?.message ?? "Could not accept request.";
        Alert.alert("Extension", msg);
        setState((prev) => ({ ...prev, phase: "error", message: msg }));
      }
    },
    [isTrainer, sessionId]
  );

  /** Trainer rejects a pending request. */
  const rejectRequest = useCallback(
    async (requestId: string) => {
      if (!isTrainer) return;
      try {
        await respondToExtensionRequest({
          sessionId,
          requestId,
          decision: "reject",
        });
      } catch (e: any) {
        const msg =
          e?.response?.data?.error ?? e?.message ?? "Could not reject request.";
        Alert.alert("Extension", msg);
      }
    },
    [isTrainer, sessionId]
  );

  /** Cancel (trainee aborts pending OR fails payment). */
  const cancelRequest = useCallback(
    async (reason?: string) => {
      const requestId = state.request?.requestId ?? lastRequestIdRef.current;
      if (!requestId) {
        reset();
        return;
      }
      try {
        await cancelExtensionRequest({
          sessionId,
          requestId,
          reason: reason ?? "user_cancelled",
        });
      } catch {
        /** Swallow — the server will still auto-expire and the socket event
         *  will reset state for everyone. */
      }
    },
    [sessionId, state.request?.requestId, reset]
  );

  /** Trainee pays via card or wallet for the currently accepted request. */
  const payAndConfirm = useCallback(
    async (options: {
      method: "card" | "wallet";
      customer?: string;
      pinSessionToken?: string | null;
      quoteId?: string;
      chargeTotalCents?: number;
      billingAddress?: { country: string; state?: string };
    }) => {
      const req = state.request;
      if (!req) return false;
      if (req.status !== "accepted") {
        Alert.alert(
          "Extension",
          "This extension is not ready for payment yet."
        );
        return false;
      }

      setState((prev) => ({ ...prev, phase: "paying", message: null }));

      try {
        const chargeMinor =
          options.chargeTotalCents ??
          (req.amount > 0 ? Math.round(req.amount * 100) : 0);

        if (options.method === "wallet") {
          if (chargeMinor > 0) {
            const bal = await fetchWalletBalance();
            const availableMinor = bal?.balances?.available_minor ?? 0;
            const needMinor = chargeMinor;
            if (availableMinor < needMinor) {
              setState((prev) => ({
                ...prev,
                phase: "awaiting_payment",
                message: "Wallet balance too low; please pay with card.",
              }));
              return false;
            }
          }
          await confirmSessionExtension({
            sessionId,
            minutes: req.minutes,
            requestId: req.requestId,
            payment_method: "wallet",
            pin_session_token: options.pinSessionToken ?? null,
            quoteId: options.quoteId,
          });
          // SESSION_EXTENSION_APPLIED socket event will flip us to "applied".
          return true;
        }

        // Card path: create PI, present sheet, confirm.
        const intent = await createSessionExtensionPaymentIntent({
          sessionId,
          minutes: req.minutes,
          requestId: req.requestId,
          customer: options.customer,
          quoteId: options.quoteId,
          billingAddress: options.billingAddress,
        });

        let paymentIntentId: string | null = null;
        if (intent?.skip) {
          // Zero-amount: server allowed confirm with no payment.
        } else {
          const clientSecret = intent?.client_secret;
          if (!clientSecret) {
            throw new Error("Stripe didn't return a client secret.");
          }
          const { error: initErr } = await initPaymentSheet({
            paymentIntentClientSecret: clientSecret,
            merchantDisplayName: "NetQwix",
          });
          if (initErr) throw new Error(initErr.message);
          const { error: payErr } = await presentPaymentSheet();
          if (payErr) {
            if (payErr.code === "Canceled") {
            setState((prev) => ({
              ...prev,
              phase: "awaiting_payment",
              message: "Payment cancelled — you can try again before the timer runs out.",
            }));
            return false;
          }
            throw new Error(payErr.message);
          }
          paymentIntentId = intent?.id ?? null;
        }

        await confirmSessionExtension({
          sessionId,
          minutes: req.minutes,
          requestId: req.requestId,
          payment_intent_id: paymentIntentId,
          payment_method: paymentIntentId ? "card" : undefined,
          quoteId: options.quoteId,
        });
        return true;
      } catch (e: any) {
        const msg =
          e?.response?.data?.error ??
          e?.response?.data?.message ??
          e?.message ??
          "Payment failed.";
        if (shouldCancelExtensionOnPaymentFailure(msg)) {
          await cancelRequest(`payment_failed:${msg}`).catch(() => undefined);
          setState((prev) => ({ ...prev, phase: "error", message: msg }));
        } else {
          setState((prev) => ({
            ...prev,
            phase: "awaiting_payment",
            message: msg,
          }));
        }
        return false;
      }
    },
    [
      cancelRequest,
      initPaymentSheet,
      presentPaymentSheet,
      sessionId,
      state.request,
    ]
  );

  /** Helper: fetch a fresh quote (used by the trainee modal to refresh price
   *  when the user toggles minutes before triggering /request). */
  const fetchQuote = useCallback(
    (minutes: number) => fetchSessionExtensionQuote(sessionId, minutes),
    [sessionId]
  );

  const isBusy = useMemo(
    () => state.phase === "requesting" || state.phase === "paying",
    [state.phase]
  );

  return {
    state,
    isBusy,
    fetchQuote,
    requestExtension,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    payAndConfirm,
    reset,
    /** Convenience: my id (passed through) so consumers can tell whether the
     *  incoming request originated from them or the peer. */
    myUserId,
  };
}
