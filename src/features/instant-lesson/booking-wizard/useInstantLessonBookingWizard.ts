import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";
import { useAuth } from "../../auth/context/AuthContext";
import { useInstantLesson } from "../InstantLessonContext";
import {
  addTraineeClipsToBookedSession,
  fetchMyClipsForBooking,
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
import { fetchSessionPricingQuote } from "../../payments/fetchSessionPricingQuote";
import type { PricingQuote } from "../../payments/pricingTypes";
import { chargeTotalDollars } from "../../payments/pricingTypes";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { postReferralPreviewCheckout } from "../../referral/api/referralApi";
import {
  promoDisplayLabel,
  promoSponsorFromResult,
} from "../../../lib/promo/promoDisplay";

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
  const [quoteId, setQuoteId] = useState<string | undefined>();
  const [chargingPrice, setChargingPrice] = useState(0);
  const [pricingQuote, setPricingQuote] = useState<PricingQuote | null>(null);
  const [durationPreviewQuote, setDurationPreviewQuote] = useState<PricingQuote | null>(null);
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
      quoteId?: string;
      pricingQuote?: PricingQuote | null;
    }) => {
      setPaymentIntentId(payload.paymentIntentId);
      setChargingPrice(payload.chargingPrice);
      setPaymentMethod(payload.paymentMethod);
      setPinSessionToken(payload.pinSessionToken);
      setQuoteId(payload.quoteId ?? payload.pricingQuote?.quoteId);
      if (payload.pricingQuote) setPricingQuote(payload.pricingQuote);
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
    setQuoteId(undefined);
    setChargingPrice(0);
    setPromoResult(null);
    setPromoValidating(false);
  }, []);

  useEffect(() => {
    if (visible) {
      const promoUrl = tid
        ? `${API_ROUTES.promo.visible}?trainer_id=${encodeURIComponent(tid)}`
        : API_ROUTES.promo.visible;
      apiClient
        .get(promoUrl)
        .then((res: any) => setVisiblePromos(res?.data?.data || []))
        .catch(() => {});
      void queryClient.prefetchQuery({
        queryKey: queryKeys.wallet.balance,
        queryFn: fetchWalletBalance,
      });
    }
  }, [visible, queryClient, tid]);

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
    queryFn: fetchMyClipsForBooking,
    enabled: visible && (step === "clips" || step === "confirm"),
    staleTime: 30_000,
  });

  const flatClips = clipsQuery.data ?? [];

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
        trainer_id: tid || undefined,
      });
      const data = res?.data;
      if (data?.valid) {
        setPromoResult(data);
        setCouponError("");
        void queryClient.invalidateQueries({
          queryKey: queryKeys.referral.checkoutPreview(
            "instant",
            expectedPrice,
            couponCode.trim(),
            tid
          ),
        });
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
  }, [couponCode, validateCoupon, expectedPrice, queryClient, tid]);

  const handleRemovePromo = useCallback(() => {
    setCouponCode("");
    setPromoResult(null);
    setCouponError("");
  }, []);

  const checkoutPreviewQuery = useQuery({
    queryKey: queryKeys.referral.checkoutPreview(
      "instant",
      expectedPrice,
      couponCode.trim(),
      tid
    ),
    queryFn: () =>
      postReferralPreviewCheckout({
        amount: expectedPrice,
        booking_type: "instant",
        coupon_code: couponCode.trim() || undefined,
        trainer_id: tid || undefined,
      }),
    enabled: visible && expectedPrice > 0,
    staleTime: 20_000,
  });

  const promoDiscountAmount = useMemo(() => {
    const preview = checkoutPreviewQuery.data?.promoDiscount;
    if (preview != null && preview > 0) return Number(preview);
    if (promoResult?.valid && promoResult.discount_amount != null) {
      return Number(promoResult.discount_amount);
    }
    return 0;
  }, [checkoutPreviewQuery.data, promoResult]);

  const promoSponsorType = useMemo(
    () =>
      promoSponsorFromResult(promoResult) ??
      checkoutPreviewQuery.data?.promoSponsorType ??
      undefined,
    [promoResult, checkoutPreviewQuery.data]
  );

  const promoLabel = useMemo(
    () => promoDisplayLabel(promoSponsorType, promoResult?.display_label),
    [promoSponsorType, promoResult?.display_label]
  );

  const payableAmount = useMemo(() => {
    const preview = checkoutPreviewQuery.data;
    if (preview?.finalPrice != null) return Number(preview.finalPrice);
    if (promoResult?.valid && promoResult.final_amount != null) {
      return Number(promoResult.final_amount);
    }
    return expectedPrice;
  }, [checkoutPreviewQuery.data, promoResult, expectedPrice]);

  useEffect(() => {
    if (!visible || step !== "duration" || !tid || payableAmount <= 0) {
      setDurationPreviewQuote(null);
      return;
    }
    let cancelled = false;
    void fetchSessionPricingQuote({
      productType: "instant_lesson",
      sessionSubtotalCents: Math.round(expectedPrice * 100),
      trainerId: tid,
      promoDiscountCents: Math.round(promoDiscountAmount * 100),
      promoSponsorType,
      user: user as Record<string, unknown>,
    })
      .then((q) => {
        if (!cancelled) setDurationPreviewQuote(q);
      })
      .catch(() => {
        if (!cancelled) setDurationPreviewQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, step, tid, payableAmount, expectedPrice, durationMinutes, promoDiscountAmount, promoSponsorType]);

  useEffect(() => {
    if (!visible || step !== "confirm" || !tid || payableAmount <= 0 || pricingQuote) {
      return;
    }
    let cancelled = false;
    void fetchSessionPricingQuote({
      productType: "instant_lesson",
      sessionSubtotalCents: Math.round(expectedPrice * 100),
      trainerId: tid,
      promoDiscountCents: Math.round(promoDiscountAmount * 100),
      promoSponsorType,
      user: user as Record<string, unknown>,
    })
      .then((q) => {
        if (!cancelled) {
          setPricingQuote(q);
          if (chargingPrice <= 0 || chargingPrice === payableAmount) {
            setChargingPrice(q.chargeTotalCents / 100);
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    visible,
    step,
    tid,
    payableAmount,
    expectedPrice,
    pricingQuote,
    chargingPrice,
    durationMinutes,
    promoDiscountAmount,
    promoSponsorType,
  ]);

  const goNext = useCallback(() => {
    const i = wizardStepIndex(step);
    if (step === "duration" && !validateCoupon()) return;
    const nextStep = WIZARD_STEPS[i + 1];
    if (step === "clips" && nextStep === "payment" && requiresPayment && payableAmount > 0) {
      void (async () => {
        const quoteTotal =
          chargeTotalDollars(pricingQuote ?? durationPreviewQuote) ?? payableAmount;
        const ok = await confirmProceedToPaymentIfWalletShort(quoteTotal, (shortfall) => {
          navigateToWalletTopUp(shortfall);
        });
        if (ok) setStep("payment");
      })();
      return;
    }
    if (i < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[i + 1]!);
  }, [step, validateCoupon, requiresPayment, payableAmount, pricingQuote, durationPreviewQuote]);

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
      if (quoteId) bookingPayload.quote_id = quoteId;
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
      Alert.alert("Booking failed", getApiErrorMessage(err, "Could not book the instant lesson."));
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
    pricingQuote,
    durationPreviewQuote,
    payableAmount,
    promoValidating,
    promoResult,
    promoDiscountAmount,
    promoLabel,
    promoSponsorType,
    handleApplyPromo,
    handleRemovePromo,
    visiblePromos,
    expectedPrice,
    eligibility: eligibilityQuery.data,
    eligibilityLoading: eligibilityQuery.isLoading,
  };
}
