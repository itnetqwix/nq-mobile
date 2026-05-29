import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { useAuth } from "../../auth/context/AuthContext";
import { useInstantLesson } from "../InstantLessonContext";
import {
  addTraineeClipsToBookedSession,
  fetchMyClipsGrouped,
  flattenGroupedClips,
} from "../instantLessonClipsApi";
import { MAX_CLIPS, WIZARD_STEPS, wizardStepIndex } from "./constants";
import { parseInstantBookingMeta } from "./parseInstantBookingLessonId";
import type { WizardStep, WizardTrainer } from "./types";
import { idempotencyHeaders, newIdempotencyKey } from "../../../lib/idempotency";
import { queryKeys } from "../../../lib/queryKeys";
import { confirmProceedToPaymentIfWalletShort } from "../../../lib/booking/bookingWalletGuard";
import { navigateToWalletTopUp } from "../../../navigation/navigationRef";
import { fetchWalletBalance } from "../../wallet/walletApi";
import { fetchInstantLessonEligibility } from "../../home/api/homeApi";

function trainerIdOf(t: WizardTrainer): string {
  if (!t) return "";
  return String(t._id ?? t.id ?? "");
}

function trainerNameOf(t: WizardTrainer): string {
  if (!t) return "";
  return String(t.fullname ?? t.fullName ?? "Trainer");
}

type UseWizardArgs = {
  visible: boolean;
  trainer: WizardTrainer;
  onDismiss: () => void;
};

export function useInstantLessonBookingWizard({ visible, trainer, onDismiss }: UseWizardArgs) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { startBooking } = useInstantLesson();

  const [step, setStep] = useState<WizardStep>("duration");
  const [durationMinutes, setDurationMinutesState] = useState(30);
  const setDurationMinutes = useCallback((minutes: number) => {
    setDurationMinutesState(minutes);
    setPromoResult(null);
    setCouponError("");
  }, []);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card" | undefined>();
  const [pinSessionToken, setPinSessionToken] = useState<string | undefined>();
  const [chargingPrice, setChargingPrice] = useState(0);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount_type?: string;
    discount_value?: number;
    discount_amount?: number;
    final_amount?: number;
    display_label?: string;
  } | null>(null);
  const [visiblePromos, setVisiblePromos] = useState<any[]>([]);

  const tid = trainerIdOf(trainer);
  const tname = trainerNameOf(trainer);
  const userStripeId = String(
    (user as Record<string, unknown>)?.stripe_account_id ?? ""
  );

  const handlePaymentComplete = useCallback(
    (payload: {
      paymentIntentId: string | null;
      chargingPrice: number;
      paymentMethod?: "wallet" | "card";
      pinSessionToken?: string;
    }) => {
      setPaymentIntentId(payload.paymentIntentId);
      setChargingPrice(payload.chargingPrice);
      setPaymentMethod(payload.paymentMethod);
      setPinSessionToken(payload.pinSessionToken);
    },
    []
  );

  const resetWizard = useCallback(() => {
    setStep("duration");
    setDurationMinutesState(30);
    setCouponCode("");
    setCouponError("");
    setSelectedClipIds([]);
    setPaymentIntentId(null);
    setPaymentMethod(undefined);
    setPinSessionToken(undefined);
    setChargingPrice(0);
    setPromoResult(null);
    setPromoValidating(false);
  }, []);

  useEffect(() => {
    if (visible) {
      apiClient
        .get(API_ROUTES.promo.visible)
        .then((res: any) => setVisiblePromos(res?.data?.data || []))
        .catch(() => {});
      void queryClient.prefetchQuery({
        queryKey: queryKeys.wallet.balance,
        queryFn: fetchWalletBalance,
      });
    }
  }, [visible, queryClient]);

  useEffect(() => {
    if (!visible) resetWizard();
  }, [visible, resetWizard]);

  const eligibilityQuery = useQuery({
    queryKey: queryKeys.instant.eligibility(tid, durationMinutes),
    queryFn: () => fetchInstantLessonEligibility(tid, durationMinutes),
    enabled: visible && !!tid && durationMinutes > 0,
    staleTime: 15_000,
  });

  const clipsQuery = useQuery({
    queryKey: queryKeys.instant.wizardClips,
    queryFn: fetchMyClipsGrouped,
    enabled: visible && step === "clips",
    staleTime: 30_000,
  });

  const flatClips = useMemo(() => flattenGroupedClips(clipsQuery.data ?? []), [clipsQuery.data]);

  const toggleClip = useCallback((id: string) => {
    setSelectedClipIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_CLIPS) {
        Alert.alert("Limit reached", `You can attach at most ${MAX_CLIPS} clips.`);
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const validateCoupon = useCallback(() => {
    if (couponCode.length > 50) {
      setCouponError("Promo code cannot exceed 50 characters.");
      return false;
    }
    setCouponError("");
    return true;
  }, [couponCode]);

  const trainerHourlyRate = Number(
    (trainer as Record<string, unknown>)?.extraInfo
      ? ((trainer as any).extraInfo as Record<string, unknown>)?.hourly_rate
      : (trainer as any)?.userInfo?.extraInfo?.hourly_rate ?? 0
  );
  const expectedPrice = Number(((trainerHourlyRate / 60) * durationMinutes).toFixed(2));
  const requiresPayment = trainerHourlyRate > 0 && expectedPrice > 0;

  const handleApplyPromo = useCallback(async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a promo code.");
      return;
    }
    if (!validateCoupon()) return;
    setPromoValidating(true);
    setPromoResult(null);
    try {
      const res = await apiClient.post(API_ROUTES.promo.validate, {
        code: couponCode.trim(),
        booking_type: "instant",
        amount: expectedPrice,
      });
      const data = res?.data;
      if (data?.valid) {
        setPromoResult(data);
        setCouponError("");
      } else {
        setPromoResult(null);
        setCouponError(data?.reason || "Invalid promo code.");
      }
    } catch {
      setPromoResult(null);
      setCouponError("Failed to validate promo code.");
    } finally {
      setPromoValidating(false);
    }
  }, [couponCode, validateCoupon, expectedPrice]);

  const handleRemovePromo = useCallback(() => {
    setCouponCode("");
    setPromoResult(null);
    setCouponError("");
  }, []);

  const payableAmount = useMemo(() => {
    if (promoResult?.valid && promoResult.final_amount != null) {
      return Number(promoResult.final_amount);
    }
    return expectedPrice;
  }, [promoResult, expectedPrice]);

  const goNext = useCallback(() => {
    const i = wizardStepIndex(step);
    if (step === "duration" && !validateCoupon()) return;
    const nextStep = WIZARD_STEPS[i + 1];
    if (step === "clips" && nextStep === "payment" && requiresPayment && payableAmount > 0) {
      void (async () => {
        const ok = await confirmProceedToPaymentIfWalletShort(payableAmount, (shortfall) => {
          navigateToWalletTopUp(shortfall);
        });
        if (ok) setStep("payment");
      })();
      return;
    }
    if (i < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[i + 1]!);
  }, [step, validateCoupon, requiresPayment, payableAmount]);

  const goBack = useCallback(() => {
    const i = wizardStepIndex(step);
    if (i <= 0) {
      onDismiss();
      return;
    }
    setStep(WIZARD_STEPS[i - 1]!);
  }, [step, onDismiss]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!tid) throw new Error("Missing trainer.");
      const bookingPayload: Record<string, unknown> = {
        trainer_id: tid,
        booked_date: new Date().toISOString(),
        duration: durationMinutes,
        charging_price: expectedPrice,
      };
      if (paymentIntentId) bookingPayload.payment_intent_id = paymentIntentId;
      if (paymentMethod === "wallet") {
        bookingPayload.payment_method = "wallet";
        if (pinSessionToken) bookingPayload.pin_session_token = pinSessionToken;
      }
      if (couponCode.trim()) bookingPayload.coupon_code = couponCode.trim();
      const res = await apiClient.post(API_ROUTES.trainee.bookInstantMeeting, bookingPayload, {
        headers: idempotencyHeaders(newIdempotencyKey("book-instant")),
      });
      const { lessonId, acceptDeadlineAt } = parseInstantBookingMeta(res);
      if (!lessonId) throw new Error("Server did not return a booking id.");
      if (selectedClipIds.length > 0) {
        try {
          await addTraineeClipsToBookedSession(lessonId, selectedClipIds);
        } catch (e: unknown) {
          const err = e as { response?: { data?: { message?: string } }; message?: string };
          const msg = err?.response?.data?.message ?? err?.message ?? "Clips could not be linked.";
          Alert.alert("Clips", `${msg} You can still continue; add clips from the session later if needed.`);
        }
      }
      const traineeId = String((user as Record<string, unknown>)?._id ?? (user as Record<string, unknown>)?.id ?? "");
      startBooking({
        lessonId,
        coachId: tid,
        traineeId,
        trainerName: tname,
        durationMinutes,
        acceptDeadlineAt,
      });

      /** Trainer notification is persisted by the backend in `emitBookingCreated`. */
    },
    onSuccess: () => {
      onDismiss();
      resetWizard();
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      Alert.alert(
        "Booking failed",
        e?.response?.data?.message ?? e?.message ?? "Could not book the instant lesson."
      );
    },
  });

  const handleSendRequest = useCallback(() => {
    if (!validateCoupon()) return;
    if (eligibilityQuery.data && !eligibilityQuery.data.eligible) {
      Alert.alert(
        "Cannot book now",
        eligibilityQuery.data.reasons.join("\n") || "This coach is not available for an instant lesson."
      );
      return;
    }
    const promoMadeFree = requiresPayment && chargingPrice === 0 && !paymentIntentId;
    if (requiresPayment && !paymentIntentId && !promoMadeFree) {
      Alert.alert(
        "Payment required",
        `This trainer charges $${trainerHourlyRate}/hr. Please complete payment before booking.`
      );
      return;
    }
    submitMutation.mutate();
  }, [
    validateCoupon,
    submitMutation,
    requiresPayment,
    paymentIntentId,
    trainerHourlyRate,
    chargingPrice,
    eligibilityQuery.data,
  ]);

  const stepNum = wizardStepIndex(step) + 1;
  const totalSteps = WIZARD_STEPS.length;

  return {
    step,
    stepNum,
    totalSteps,
    trainer,
    trainerName: tname,
    durationMinutes,
    setDurationMinutes,
    couponCode,
    setCouponCode,
    couponError,
    setCouponError,
    selectedClipIds,
    toggleClip,
    clipsQuery,
    flatClips,
    goNext,
    goBack,
    handleSendRequest,
    submitIsPending: submitMutation.isPending,
    userStripeId,
    handlePaymentComplete,
    paymentIntentId,
    chargingPrice,
    promoValidating,
    promoResult,
    handleApplyPromo,
    handleRemovePromo,
    visiblePromos,
    expectedPrice,
    eligibility: eligibilityQuery.data,
    eligibilityLoading: eligibilityQuery.isLoading,
  };
}
