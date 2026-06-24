import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";
import { addEventToCalendar } from "../../lib/calendar/addToCalendar";
import { useAuth } from "../auth/context/AuthContext";
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_TYPES,
  useNotifications,
} from "../notifications/NotificationContext";
import {
  SCHEDULED_DURATIONS,
  SCHEDULED_BOOKING_BUFFER_MINUTES,
  SCHEDULED_MIN_LEAD_TIME_MINUTES,
  SCHEDULED_WIZARD_STEPS,
  scheduledStepIndex,
  type ScheduledWizardStep,
} from "./constants";
import { queryKeys } from "../../lib/queryKeys";
import { upsertSessionInQueryCaches } from "../../lib/queryInvalidation";
import { confirmProceedToPaymentIfWalletShort } from "../../lib/booking/bookingWalletGuard";
import { resolvePaymentMethodHint } from "../../lib/payments/pricingQuoteHint";
import { getApiErrorMessage } from "../../lib/http/getApiErrorMessage";
import { chargeTotalDollars } from "../payments/pricingTypes";
import { navigateToWalletTopUp } from "../../navigation/navigationRef";
import { bookScheduledSession, fetchDayAvailability, holdScheduledSlot, validateSlotRange } from "./scheduledBookingApi";
import {
  addTraineeClipsToBookedSession,
  fetchMyClipsForBooking,
} from "../instant-lesson/instantLessonClipsApi";
import { parseInstantBookingMeta } from "../instant-lesson/booking-wizard/parseInstantBookingLessonId";
import { MAX_CLIPS } from "../instant-lesson/booking-wizard/constants";
import {
  buildStartCandidates,
  formatDisplayTime,
  parseSlotTimeOnDate,
  resolveSuggestionDateIso,
  toHHmm,
  windowsFromApiSlots,
  type SlotWindow,
} from "./timeSlotUtils";
import {
  getTrainerField,
  trainerHourlyRate,
  trainerIdOf,
  trainerNameOf,
} from "./trainerUtils";
import { fetchSessionPricingQuote } from "../payments/fetchSessionPricingQuote";
import type { PricingQuote } from "../payments/pricingTypes";
import { fetchSmartSchedule, type SmartScheduleSuggestion } from "../ai/smartScheduleApi";
import { pickAvailableDurations, isSlotConflictMessage } from "./scheduledBookingFlow";
import { resolveTraineeTimeZone } from "../../lib/user/resolveTraineeTimeZone";
import { postReferralPreviewCheckout } from "../referral/api/referralApi";
import { useAppTranslation } from "../../i18n/useAppTranslation";
import {
  promoDisplayLabel,
  promoSponsorFromResult,
} from "../../lib/promo/promoDisplay";
import { useWalletBalance } from "../wallet/hooks/useWalletBalance";
import {
  resolvePinSessionTokenForSubmit,
  validateWalletPinBeforeSubmit,
} from "../wallet/security/walletPinPaymentFlow";

export type ScheduledTrainer = Record<string, unknown> | null;

type Args = {
  visible: boolean;
  trainer: ScheduledTrainer;
  onDismiss: () => void;
  onBooked?: () => void;
};

export function useScheduledBookingWizard({ visible, trainer, onDismiss, onBooked }: Args) {
  const { user } = useAuth();
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { emitNotification, pushLocalToast } = useNotifications();

  const [step, setStep] = useState<ScheduledWizardStep>("datetime");
  const [selectedDate, setSelectedDate] = useState(() =>
    DateTime.now().toISODate()!
  );
  const [selectedStartIso, setSelectedStartIso] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutesState] = useState(30);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount_amount?: number;
    final_amount?: number;
    display_label?: string;
  } | null>(null);
  const [visiblePromos, setVisiblePromos] = useState<any[]>([]);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card" | "mixed" | undefined>();
  const [pinSessionToken, setPinSessionToken] = useState<string | undefined>();
  const [walletAmount, setWalletAmount] = useState<number | undefined>();
  const [quoteId, setQuoteId] = useState<string | undefined>();
  const [chargingPrice, setChargingPrice] = useState(0);
  const [pricingQuote, setPricingQuote] = useState<PricingQuote | null>(null);
  const [durationPreviewQuote, setDurationPreviewQuote] = useState<PricingQuote | null>(null);
  const [trainerTimezone, setTrainerTimezone] = useState<string | null>(null);

  const tid = trainerIdOf(trainer);
  const smartScheduleQuery = useQuery({
    queryKey: queryKeys.ai.smartSchedule(tid ?? ""),
    queryFn: () => fetchSmartSchedule(tid!),
    enabled: visible && step === "datetime" && !!tid,
    staleTime: 300_000,
    retry: 1,
  });
  const tname = trainerNameOf(trainer);
  const hourlyRate = trainerHourlyRate(trainer);
  const traineeTz = resolveTraineeTimeZone(user as Record<string, unknown> | undefined);
  const userStripeId = String((user as Record<string, unknown>)?.stripe_account_id ?? "");
  const trainerStripeId = String(getTrainerField(trainer, "stripe_account_id") ?? "");
  const commission = String(getTrainerField(trainer, "commission") ?? "0");

  const bookedDateIso = useMemo(() => {
    const d = DateTime.fromISO(selectedDate, { zone: traineeTz });
    return d.isValid ? d.toISODate()! : selectedDate.split("T")[0]!;
  }, [selectedDate, traineeTz]);

  const setDurationMinutes = useCallback((minutes: number) => {
    setDurationMinutesState(minutes);
    setPromoResult(null);
    setCouponError("");
  }, []);

  const resetWizard = useCallback(() => {
    setStep("datetime");
    setSelectedDate(DateTime.now().setZone(traineeTz).toISODate()!);
    setSelectedStartIso(null);
    setDurationMinutesState(30);
    setSelectedClipIds([]);
    setCouponCode("");
    setCouponError("");
    setPromoResult(null);
    setPaymentIntentId(null);
    setPaymentMethod(undefined);
    setPinSessionToken(undefined);
    setQuoteId(undefined);
    setChargingPrice(0);
    setTrainerTimezone(null);
  }, [traineeTz]);

  useEffect(() => {
    if (!visible) resetWizard();
  }, [visible, resetWizard]);

  useEffect(() => {
    if (visible) {
      const promoUrl = tid
        ? `${API_ROUTES.promo.visible}?trainer_id=${encodeURIComponent(tid)}`
        : API_ROUTES.promo.visible;
      apiClient
        .get(promoUrl)
        .then((res: any) => setVisiblePromos(res?.data?.data || []))
        .catch(() => {});
    }
  }, [visible, tid]);

  const dayAvailabilityQuery = useQuery({
    queryKey: queryKeys.scheduled.checkSlot(tid, bookedDateIso, traineeTz),
    queryFn: async () => {
      const data = await fetchDayAvailability({
        trainerId: tid,
        bookedDateIso,
        traineeTimeZone: traineeTz,
      });
      if (data.trainerTimezone) setTrainerTimezone(data.trainerTimezone);
      return data;
    },
    enabled: visible && !!tid && !!bookedDateIso,
    staleTime: 30_000,
    refetchInterval: visible && step === "datetime" ? 60_000 : false,
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

  const slotWindows: SlotWindow[] = useMemo(() => {
    const slots = dayAvailabilityQuery.data?.availableSlots ?? [];
    return windowsFromApiSlots(slots, bookedDateIso, traineeTz);
  }, [dayAvailabilityQuery.data?.availableSlots, bookedDateIso, traineeTz]);

  const candidateDurationMinutes =
    step === "datetime" ? SCHEDULED_DURATIONS[0]! : durationMinutes;

  const startCandidates = useMemo(
    () =>
      buildStartCandidates(slotWindows, candidateDurationMinutes, 15, {
        now: DateTime.now().setZone(traineeTz),
      }),
    [slotWindows, candidateDurationMinutes, traineeTz]
  );

  useEffect(() => {
    if (!selectedStartIso) return;
    if (dayAvailabilityQuery.isLoading || dayAvailabilityQuery.isFetching) return;
    const startDay = DateTime.fromISO(selectedStartIso, { zone: traineeTz }).toISODate();
    if (startDay !== bookedDateIso) return;
    const stillValid = startCandidates.some((c) => c.toISO() === selectedStartIso);
    if (!stillValid) setSelectedStartIso(null);
  }, [
    startCandidates,
    selectedStartIso,
    bookedDateIso,
    traineeTz,
    dayAvailabilityQuery.isLoading,
    dayAvailabilityQuery.isFetching,
  ]);

  const selectedStart = useMemo(() => {
    if (!selectedStartIso) return null;
    return DateTime.fromISO(selectedStartIso, { zone: traineeTz });
  }, [selectedStartIso, traineeTz]);

  const sessionEnd = useMemo(() => {
    if (!selectedStart) return null;
    return selectedStart.plus({ minutes: durationMinutes });
  }, [selectedStart, durationMinutes]);

  const availableDurations = useMemo(
    () => pickAvailableDurations(slotWindows, selectedStartIso, traineeTz),
    [selectedStartIso, slotWindows, traineeTz]
  );

  useEffect(() => {
    if (!availableDurations.includes(durationMinutes as (typeof SCHEDULED_DURATIONS)[number])) {
      const fallback = availableDurations[0];
      if (fallback != null) setDurationMinutesState(fallback);
    }
  }, [availableDurations, durationMinutes]);

  const validateCurrentSlot = useCallback(async () => {
    if (!tid || !selectedStart || !sessionEnd) {
      return {
        ok: false as const,
        message: t("scheduledBooking.alerts.chooseTimeFirst"),
      };
    }
    const slotCheck = await validateSlotRange({
      trainerId: tid,
      bookedDateIso,
      traineeTimeZone: traineeTz,
      from: toHHmm(selectedStart),
      to: toHHmm(sessionEnd),
    });
    if (slotCheck.isAvailable === false) {
      return {
        ok: false as const,
        message:
          slotCheck.message ?? t("scheduledBooking.alerts.slotUnavailableBody"),
      };
    }
    return { ok: true as const };
  }, [tid, selectedStart, sessionEnd, bookedDateIso, traineeTz, t]);

  const handleSlotUnavailable = useCallback(
    (message?: string, options?: { titleKey?: string; bodyKey?: string }) => {
      Alert.alert(
        t(options?.titleKey ?? "scheduledBooking.alerts.slotUnavailableTitle"),
        options?.bodyKey
          ? t(options.bodyKey)
          : message ?? t("scheduledBooking.alerts.slotUnavailableBody")
      );
      setSelectedStartIso(null);
      setStep("datetime");
      void dayAvailabilityQuery.refetch();
    },
    [t, dayAvailabilityQuery]
  );

  const returnToDateTime = useCallback(() => {
    setStep("datetime");
  }, []);

  const reserveCurrentSlot = useCallback(async (): Promise<boolean> => {
    if (!tid || !selectedStart || !sessionEnd) return false;
    try {
      const hold = await holdScheduledSlot({
        trainerId: tid,
        bookedDateIso,
        traineeTimeZone: traineeTz,
        from: toHHmm(selectedStart),
        to: toHHmm(sessionEnd),
      });
      return hold.held === true;
    } catch {
      return false;
    }
  }, [tid, selectedStart, sessionEnd, bookedDateIso, traineeTz]);

  const advanceFromPayment = useCallback(() => {
    void (async () => {
      await reserveCurrentSlot();
      const slotOk = await validateCurrentSlot();
      if (!slotOk.ok) {
        handleSlotUnavailable(slotOk.message, {
          titleKey: "scheduledBooking.alerts.bookingFailedPaidTitle",
          bodyKey: "scheduledBooking.alerts.bookingFailedPaidBody",
        });
        return;
      }
      setStep("confirm");
    })();
  }, [reserveCurrentSlot, validateCurrentSlot, handleSlotUnavailable]);

  useEffect(() => {
    if (!visible || step !== "payment" || !tid || !selectedStart || !sessionEnd) return;
    void reserveCurrentSlot();
  }, [visible, step, tid, selectedStart, sessionEnd, reserveCurrentSlot]);

  const expectedPrice = useMemo(
    () => Number(((hourlyRate / 60) * durationMinutes).toFixed(2)),
    [hourlyRate, durationMinutes]
  );

  const checkoutPreviewQuery = useQuery({
    queryKey: queryKeys.referral.checkoutPreview(
      "scheduled",
      expectedPrice,
      couponCode.trim(),
      tid
    ),
    queryFn: () =>
      postReferralPreviewCheckout({
        amount: expectedPrice,
        booking_type: "scheduled",
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

  const { data: walletBalance } = useWalletBalance(visible);
  const walletAvailable = walletBalance?.balances?.available ?? 0;
  const durationQuotePaymentHint = useMemo(
    () =>
      resolvePaymentMethodHint(
        walletAvailable,
        chargeTotalDollars(durationPreviewQuote) ?? payableAmount
      ),
    [walletAvailable, durationPreviewQuote, payableAmount]
  );
  const confirmQuotePaymentHint = useMemo(
    () =>
      resolvePaymentMethodHint(
        walletAvailable,
        chargeTotalDollars(pricingQuote) ?? payableAmount
      ),
    [walletAvailable, pricingQuote, payableAmount]
  );


  const validateCoupon = useCallback(() => {
    if (couponCode.length > 50) {
      setCouponError("Promo code cannot exceed 50 characters.");
      return false;
    }
    setCouponError("");
    return true;
  }, [couponCode]);

  const handleApplyPromo = useCallback(async (codeOverride?: string) => {
    const code = (codeOverride ?? couponCode).trim();
    if (!code) {
      setCouponError("Please enter a promo code.");
      return;
    }
    if (code.length > 50) {
      setCouponError("Promo code cannot exceed 50 characters.");
      return;
    }
    if (codeOverride) {
      setCouponCode(codeOverride);
    }
    setPromoValidating(true);
    setPromoResult(null);
    try {
      const res = await apiClient.post(API_ROUTES.promo.validate, {
        code,
        booking_type: "scheduled",
        amount: expectedPrice,
        trainer_id: tid || undefined,
      });
      const data = res?.data;
      if (data?.valid) {
        setPromoResult(data);
        setCouponError("");
        void queryClient.invalidateQueries({
          queryKey: queryKeys.referral.checkoutPreview("scheduled", expectedPrice, code, tid),
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
  }, [couponCode, expectedPrice, tid, queryClient]);

  const handleRemovePromo = useCallback(() => {
    setCouponCode("");
    setPromoResult(null);
    setCouponError("");
  }, []);

  const handlePaymentComplete = useCallback(
    (payload: {
      paymentIntentId: string | null;
      chargingPrice: number;
      paymentMethod?: "wallet" | "card" | "mixed";
      walletAmount?: number;
      pinSessionToken?: string;
      quoteId?: string;
      pricingQuote?: PricingQuote | null;
    }) => {
      setPaymentIntentId(payload.paymentIntentId);
      setChargingPrice(payload.chargingPrice);
      setPaymentMethod(payload.paymentMethod);
      setWalletAmount(payload.walletAmount);
      setPinSessionToken(payload.pinSessionToken);
      setQuoteId(payload.quoteId ?? payload.pricingQuote?.quoteId);
      if (payload.pricingQuote) setPricingQuote(payload.pricingQuote);
    },
    []
  );

  useEffect(() => {
    if (!visible || step !== "duration" || !tid || payableAmount <= 0) {
      setDurationPreviewQuote(null);
      return;
    }
    let cancelled = false;
    void fetchSessionPricingQuote({
      productType: "session_booking",
      sessionSubtotalCents: Math.round(expectedPrice * 100),
      trainerId: tid,
      promoDiscountCents: Math.round(promoDiscountAmount * 100),
      promoSponsorType,
      user: user as Record<string, unknown>,
      paymentMethodHint: durationQuotePaymentHint,
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
  }, [visible, step, tid, payableAmount, expectedPrice, durationMinutes, promoDiscountAmount, promoSponsorType, durationQuotePaymentHint, user]);

  useEffect(() => {
    if (!visible || step !== "confirm" || !tid || payableAmount <= 0 || pricingQuote) {
      return;
    }
    let cancelled = false;
    void fetchSessionPricingQuote({
      productType: "session_booking",
      sessionSubtotalCents: Math.round(expectedPrice * 100),
      trainerId: tid,
      promoDiscountCents: Math.round(promoDiscountAmount * 100),
      promoSponsorType,
      user: user as Record<string, unknown>,
      paymentMethodHint: confirmQuotePaymentHint,
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
    confirmQuotePaymentHint,
    user,
  ]);

  const goNext = useCallback(() => {
    const i = scheduledStepIndex(step);
    void (async () => {
      if (step === "datetime") {
        if (!selectedStart) {
          Alert.alert(
            t("scheduledBooking.alerts.selectTimeTitle"),
            t("scheduledBooking.alerts.selectTimeBody")
          );
          return;
        }
      }
      if (step === "duration") {
        if (!selectedStart) {
          Alert.alert(
            t("scheduledBooking.alerts.selectTimeTitle"),
            t("scheduledBooking.alerts.selectTimeGoBack")
          );
          return;
        }
        if (!availableDurations.length) {
          Alert.alert(
            t("scheduledBooking.alerts.noDurationsTitle"),
            t("scheduledBooking.alerts.noDurationsBody")
          );
          return;
        }
        const slotOk = await validateCurrentSlot();
        if (!slotOk.ok) {
          handleSlotUnavailable(slotOk.message);
          return;
        }
      }
      if (step === "clips") {
        const slotOk = await validateCurrentSlot();
        if (!slotOk.ok) {
          handleSlotUnavailable(slotOk.message);
          return;
        }
      }
      if (step === "promo" && !validateCoupon()) return;
      if (step === "promo") {
        const skipPayment =
          hourlyRate <= 0 || expectedPrice <= 0 || payableAmount <= 0;
        if (skipPayment) {
          const slotOk = await validateCurrentSlot();
          if (!slotOk.ok) {
            handleSlotUnavailable(slotOk.message);
            return;
          }
          setChargingPrice(0);
          setStep("confirm");
          return;
        }
        const nextStep = SCHEDULED_WIZARD_STEPS[scheduledStepIndex(step) + 1];
        if (nextStep === "payment") {
          const slotOk = await validateCurrentSlot();
          if (!slotOk.ok) {
            handleSlotUnavailable(slotOk.message);
            return;
          }
          const quoteTotal = chargeTotalDollars(pricingQuote) ?? payableAmount;
          const ok = await confirmProceedToPaymentIfWalletShort(quoteTotal, (shortfall) => {
            navigateToWalletTopUp(shortfall);
          });
          if (ok) {
            await reserveCurrentSlot();
            setStep("payment");
          }
          return;
        }
      }
      if (i < SCHEDULED_WIZARD_STEPS.length - 1) setStep(SCHEDULED_WIZARD_STEPS[i + 1]!);
    })();
  }, [
    step,
    selectedStart,
    availableDurations.length,
    validateCoupon,
    hourlyRate,
    expectedPrice,
    payableAmount,
    pricingQuote,
    validateCurrentSlot,
    handleSlotUnavailable,
    reserveCurrentSlot,
    t,
  ]);

  const goBack = useCallback(() => {
    const i = scheduledStepIndex(step);
    if (i <= 0) {
      onDismiss();
      return;
    }
    setStep(SCHEDULED_WIZARD_STEPS[i - 1]!);
  }, [step, onDismiss]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!tid || !selectedStart || !sessionEnd) throw new Error("Missing session time.");
      const from = toHHmm(selectedStart);
      const to = toHHmm(sessionEnd);

      const slotCheck = await validateSlotRange({
        trainerId: tid,
        bookedDateIso,
        traineeTimeZone: traineeTz,
        from,
        to,
      });
      if (slotCheck.isAvailable === false) {
        throw new Error(
          slotCheck.message ??
            "This time is no longer available. Please choose a different slot."
        );
      }

      const bookPayload: Parameters<typeof bookScheduledSession>[0] = {
        trainer_id: tid,
        status: "booked",
        booked_date: bookedDateIso,
        session_start_time: from,
        session_end_time: to,
        charging_price: expectedPrice,
        time_zone: traineeTz,
      };
      if (couponCode.trim()) bookPayload.coupon_code = couponCode.trim();
      if (quoteId) bookPayload.quote_id = quoteId;
      if (paymentIntentId) bookPayload.payment_intent_id = paymentIntentId;
      if (chargingPrice > 0 && (paymentMethod === "wallet" || paymentMethod === "mixed")) {
        const pinToken = await resolvePinSessionTokenForSubmit(pinSessionToken);
        const pinErr = validateWalletPinBeforeSubmit({
          paymentMethod,
          chargingPrice,
          walletAmount,
          pinSet: walletBalance?.pinSet,
          pinSessionToken: pinToken,
        });
        if (pinErr) throw new Error(pinErr);
        bookPayload.payment_method = paymentMethod;
        if (paymentMethod === "mixed") {
          bookPayload.wallet_amount = walletAmount ?? 0;
        }
        if (pinToken) bookPayload.pin_session_token = pinToken;
      }

      const bookingInfo = await bookScheduledSession(bookPayload);

      const { lessonId } = parseInstantBookingMeta({ data: bookingInfo });
      if (lessonId && selectedClipIds.length > 0) {
        try {
          await addTraineeClipsToBookedSession(lessonId, selectedClipIds);
        } catch (e: unknown) {
          const err = e as { response?: { data?: { message?: string } }; message?: string };
          const msg = err?.response?.data?.message ?? err?.message ?? "Clips could not be linked.";
          Alert.alert("Clips", `${msg} You can still continue; add clips from the session later if needed.`);
        }
      }

      const traineeName = String(
        (user as Record<string, unknown>)?.fullname ??
          (user as Record<string, unknown>)?.fullName ??
          "A trainee"
      );
      emitNotification({
        title: NOTIFICATION_TITLES.newBookingRequest,
        description: `${traineeName} requested a scheduled session with you.`,
        receiverId: tid,
        type: NOTIFICATION_TYPES.TRANSCATIONAL,
        bookingInfo: bookingInfo ?? { trainer_id: tid },
      });

      return { bookingInfo, lessonId };
    },
    onSuccess: (result) => {
      const bookingInfo = result?.bookingInfo;
      const lessonId = result?.lessonId;
      if (lessonId && bookingInfo && typeof bookingInfo === "object") {
        upsertSessionInQueryCaches(queryClient, {
          ...(bookingInfo as Record<string, unknown>),
          _id: lessonId,
          status: (bookingInfo as Record<string, unknown>).status ?? "booked",
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.upcoming });
      }
      pushLocalToast({
        title: t("scheduledBooking.requestSentTitle"),
        description: t("scheduledBooking.requestSentBody"),
        persistInInbox: true,
        type: NOTIFICATION_TYPES.TRANSCATIONAL,
      });
      const startJs = selectedStart?.toJSDate();
      const endJs = sessionEnd?.toJSDate();
      const cleanup = () => {
        onBooked?.();
        onDismiss();
        resetWizard();
      };
      Alert.alert(
        t("scheduledBooking.requestSentTitle"),
        t("scheduledBooking.requestSentBody"),
        [
          {
            text: t("scheduledBooking.done"),
            style: "cancel",
            onPress: cleanup,
          },
          {
            text: t("scheduledBooking.addToCalendar"),
            onPress: async () => {
              if (startJs) {
                await addEventToCalendar({
                  title: `NetQwix session with ${tname}`,
                  startsAt: startJs,
                  endsAt: endJs,
                  durationMinutes,
                  description: t("scheduledBooking.calendarDescription"),
                  timeZone: traineeTz,
                });
              }
              cleanup();
            },
          },
        ]
      );
    },
    onError: (err: unknown) => {
      const msg = getApiErrorMessage(err, t("scheduledBooking.alerts.bookingFailedBody"));
      const paid =
        Boolean(paymentIntentId) ||
        paymentMethod === "wallet" ||
        paymentMethod === "mixed";
      if (paid && isSlotConflictMessage(msg)) {
        handleSlotUnavailable(msg, {
          titleKey: "scheduledBooking.alerts.bookingFailedPaidTitle",
          bodyKey: "scheduledBooking.alerts.bookingFailedPaidBody",
        });
        return;
      }
      Alert.alert(t("scheduledBooking.alerts.bookingFailedTitle"), msg);
    },
  });

  const handleSubmit = useCallback(() => {
    if (!validateCoupon()) return;
    const requiresPayment = hourlyRate > 0 && expectedPrice > 0;
    const promoMadeFree = requiresPayment && chargingPrice === 0 && !paymentIntentId;
    if (
      requiresPayment &&
      !paymentIntentId &&
      !promoMadeFree &&
      paymentMethod !== "wallet" &&
      paymentMethod !== "mixed"
    ) {
      if (payableAmount > 0) {
        Alert.alert(
          t("scheduledBooking.alerts.paymentRequiredTitle"),
          t("scheduledBooking.alerts.paymentRequiredBody")
        );
        return;
      }
    }
    submitMutation.mutate();
  }, [
    validateCoupon,
    submitMutation,
    hourlyRate,
    expectedPrice,
    paymentIntentId,
    chargingPrice,
    payableAmount,
    paymentMethod,
    t,
  ]);

  useEffect(() => {
    if (!visible || step !== "confirm") return;
    void (async () => {
      const slotOk = await validateCurrentSlot();
      if (!slotOk.ok) handleSlotUnavailable(slotOk.message);
    })();
  }, [visible, step, validateCurrentSlot, handleSlotUnavailable]);

  const trainerTimeLabel = useMemo(() => {
    if (!selectedStart || !trainerTimezone) return null;
    return selectedStart.setZone(trainerTimezone).toFormat("h:mm a (ZZZZ)");
  }, [selectedStart, trainerTimezone]);

  const sessionTimeSummary = useMemo(() => {
    if (!selectedStart || !sessionEnd) return "";
    return `${selectedStart.toFormat("ccc, MMM d")} · ${formatDisplayTime(selectedStart)} – ${formatDisplayTime(sessionEnd)}`;
  }, [selectedStart, sessionEnd]);

  const applySmartSuggestion = useCallback(
    (suggestion: SmartScheduleSuggestion) => {
      void (async () => {
        const dateIso = resolveSuggestionDateIso(suggestion.day, traineeTz);
        if (!dateIso) {
          Alert.alert(
            t("scheduledBooking.datetime.suggestionInvalidTitle"),
            t("scheduledBooking.datetime.suggestionInvalidBody")
          );
          return;
        }
        const dt = parseSlotTimeOnDate(dateIso, suggestion.time, traineeTz);
        if (!dt) {
          Alert.alert(
            t("scheduledBooking.datetime.suggestionInvalidTitle"),
            t("scheduledBooking.datetime.suggestionInvalidBody")
          );
          return;
        }
        const minStart = DateTime.now()
          .setZone(traineeTz)
          .plus({ minutes: SCHEDULED_MIN_LEAD_TIME_MINUTES });
        if (dt < minStart) {
          Alert.alert(
            t("scheduledBooking.datetime.suggestionTooSoonTitle"),
            t("scheduledBooking.datetime.suggestionTooSoonBody", {
              hours: SCHEDULED_MIN_LEAD_TIME_MINUTES / 60,
            })
          );
          return;
        }
        if (!tid) return;
        const probeEnd = dt.plus({ minutes: SCHEDULED_DURATIONS[0]! });
        const slotCheck = await validateSlotRange({
          trainerId: tid,
          bookedDateIso: dateIso,
          traineeTimeZone: traineeTz,
          from: toHHmm(dt),
          to: toHHmm(probeEnd),
        });
        if (slotCheck.isAvailable === false) {
          Alert.alert(
            t("scheduledBooking.alerts.suggestionUnavailableTitle"),
            slotCheck.message ?? t("scheduledBooking.alerts.suggestionUnavailableBody")
          );
          return;
        }
        setSelectedDate(dateIso);
        setSelectedStartIso(dt.toISO());
      })();
    },
    [traineeTz, t, tid]
  );

  return {
    step,
    stepNum: scheduledStepIndex(step) + 1,
    totalSteps: SCHEDULED_WIZARD_STEPS.length,
    trainer,
    trainerName: tname,
    traineeTz,
    trainerTimezone,
    trainerTimeLabel,
    bookedDateIso,
    selectedDate,
    setSelectedDate: (iso: string) => {
      setSelectedDate(iso);
      setSelectedStartIso(null);
    },
    dayAvailabilityQuery,
    startCandidates,
    selectedStartIso,
    setSelectedStartIso,
    selectedStart,
    sessionEnd,
    sessionTimeSummary,
    durationMinutes,
    setDurationMinutes,
    selectedClipIds,
    toggleClip,
    clipsQuery,
    flatClips,
    expectedPrice,
    payableAmount,
    hourlyRate,
    couponCode,
    setCouponCode,
    couponError,
    setCouponError,
    promoValidating,
    promoResult,
    promoDiscountAmount,
    promoLabel,
    promoSponsorType,
    handleApplyPromo,
    handleRemovePromo,
    visiblePromos,
    goNext,
    goBack,
    returnToDateTime,
    advanceFromPayment,
    handlePaymentComplete,
    handleSubmit,
    submitIsPending: submitMutation.isPending,
    userStripeId,
    trainerStripeId,
    commission,
    paymentIntentId,
    chargingPrice,
    pricingQuote,
    durationPreviewQuote,
    smartScheduleSuggestions: smartScheduleQuery.data?.suggestions ?? [],
    smartScheduleLoading: smartScheduleQuery.isLoading,
    availableDurations,
    applySmartSuggestion,
    parseSlotTimeOnDate: (label: string) => parseSlotTimeOnDate(bookedDateIso, label, traineeTz),
  };
}
