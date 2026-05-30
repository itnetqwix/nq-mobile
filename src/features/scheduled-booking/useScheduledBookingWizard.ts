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
  SCHEDULED_WIZARD_STEPS,
  scheduledStepIndex,
  type ScheduledWizardStep,
} from "./constants";
import { queryKeys } from "../../lib/queryKeys";
import { confirmProceedToPaymentIfWalletShort } from "../../lib/booking/bookingWalletGuard";
import { navigateToWalletTopUp } from "../../navigation/navigationRef";
import { bookScheduledSession, fetchDayAvailability, validateSlotRange } from "./scheduledBookingApi";
import {
  buildStartCandidates,
  formatDisplayTime,
  parseSlotTimeOnDate,
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

export type ScheduledTrainer = Record<string, unknown> | null;

type Args = {
  visible: boolean;
  trainer: ScheduledTrainer;
  onDismiss: () => void;
  onBooked?: () => void;
};

export function resolveTraineeTimeZone(user: Record<string, unknown> | null | undefined): string {
  const profileTz = user?.time_zone;
  if (typeof profileTz === "string" && profileTz.trim()) return profileTz.trim();
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function useScheduledBookingWizard({ visible, trainer, onDismiss, onBooked }: Args) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { emitNotification } = useNotifications();

  const [step, setStep] = useState<ScheduledWizardStep>("datetime");
  const [selectedDate, setSelectedDate] = useState(() =>
    DateTime.now().toISODate()!
  );
  const [selectedStartIso, setSelectedStartIso] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutesState] = useState(30);
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
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card" | undefined>();
  const [pinSessionToken, setPinSessionToken] = useState<string | undefined>();
  const [quoteId, setQuoteId] = useState<string | undefined>();
  const [chargingPrice, setChargingPrice] = useState(0);
  const [trainerTimezone, setTrainerTimezone] = useState<string | null>(null);

  const tid = trainerIdOf(trainer);
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
    setSelectedStartIso(null);
    setPromoResult(null);
    setCouponError("");
  }, []);

  const resetWizard = useCallback(() => {
    setStep("datetime");
    setSelectedDate(DateTime.now().setZone(traineeTz).toISODate()!);
    setSelectedStartIso(null);
    setDurationMinutesState(30);
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
      apiClient
        .get(API_ROUTES.promo.visible)
        .then((res: any) => setVisiblePromos(res?.data?.data || []))
        .catch(() => {});
    }
  }, [visible]);

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
  });

  const slotWindows: SlotWindow[] = useMemo(() => {
    const slots = dayAvailabilityQuery.data?.availableSlots ?? [];
    return windowsFromApiSlots(slots, bookedDateIso, traineeTz);
  }, [dayAvailabilityQuery.data?.availableSlots, bookedDateIso, traineeTz]);

  const candidateDurationMinutes =
    step === "datetime" ? SCHEDULED_DURATIONS[0]! : durationMinutes;

  const startCandidates = useMemo(
    () => buildStartCandidates(slotWindows, candidateDurationMinutes),
    [slotWindows, candidateDurationMinutes]
  );

  const selectedStart = useMemo(() => {
    if (!selectedStartIso) return null;
    return DateTime.fromISO(selectedStartIso, { zone: traineeTz });
  }, [selectedStartIso, traineeTz]);

  const sessionEnd = useMemo(() => {
    if (!selectedStart) return null;
    return selectedStart.plus({ minutes: durationMinutes });
  }, [selectedStart, durationMinutes]);

  const expectedPrice = useMemo(
    () => Number(((hourlyRate / 60) * durationMinutes).toFixed(2)),
    [hourlyRate, durationMinutes]
  );

  const payableAmount = useMemo(() => {
    if (promoResult?.valid && promoResult.final_amount != null) {
      return Number(promoResult.final_amount);
    }
    return expectedPrice;
  }, [promoResult, expectedPrice]);

  const validateCoupon = useCallback(() => {
    if (couponCode.length > 50) {
      setCouponError("Promo code cannot exceed 50 characters.");
      return false;
    }
    setCouponError("");
    return true;
  }, [couponCode]);

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
        booking_type: "scheduled",
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

  const handlePaymentComplete = useCallback(
    (payload: {
      paymentIntentId: string | null;
      chargingPrice: number;
      paymentMethod?: "wallet" | "card";
      pinSessionToken?: string;
      quoteId?: string;
    }) => {
      setPaymentIntentId(payload.paymentIntentId);
      setChargingPrice(payload.chargingPrice);
      setPaymentMethod(payload.paymentMethod);
      setPinSessionToken(payload.pinSessionToken);
      setQuoteId(payload.quoteId);
    },
    []
  );

  const goNext = useCallback(() => {
    const i = scheduledStepIndex(step);
    if (step === "datetime") {
      if (!selectedStart) {
        Alert.alert("Select a time", "Choose an available start time for your session.");
        return;
      }
    }
    if (step === "duration" && !selectedStart) {
      Alert.alert("Select a time", "Go back and choose a start time that fits your session length.");
      return;
    }
    if (step === "promo" && !validateCoupon()) return;
    if (step === "promo") {
      const skipPayment =
        hourlyRate <= 0 || expectedPrice <= 0 || payableAmount <= 0;
      if (skipPayment) {
        setChargingPrice(0);
        setStep("confirm");
        return;
      }
      const nextStep = SCHEDULED_WIZARD_STEPS[scheduledStepIndex(step) + 1];
      if (nextStep === "payment") {
        void (async () => {
          const ok = await confirmProceedToPaymentIfWalletShort(payableAmount, (shortfall) => {
            navigateToWalletTopUp(shortfall);
          });
          if (ok) setStep("payment");
        })();
        return;
      }
    }
    if (i < SCHEDULED_WIZARD_STEPS.length - 1) setStep(SCHEDULED_WIZARD_STEPS[i + 1]!);
  }, [
    step,
    selectedStart,
    validateCoupon,
    hourlyRate,
    expectedPrice,
    payableAmount,
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
      if (paymentMethod === "wallet" && chargingPrice > 0) {
        bookPayload.payment_method = "wallet";
        if (pinSessionToken) bookPayload.pin_session_token = pinSessionToken;
      }

      const bookingInfo = await bookScheduledSession(bookPayload);

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
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.upcoming });
      const startJs = selectedStart?.toJSDate();
      const endJs = sessionEnd?.toJSDate();
      const cleanup = () => {
        onBooked?.();
        onDismiss();
        resetWizard();
      };
      Alert.alert(
        "Session requested",
        "Your session request was sent. Your coach must confirm before it is scheduled.",
        [
          {
            text: "Done",
            style: "cancel",
            onPress: cleanup,
          },
          {
            text: "Add to Calendar",
            onPress: async () => {
              if (startJs) {
                await addEventToCalendar({
                  title: `NetQwix session with ${tname}`,
                  startsAt: startJs,
                  endsAt: endJs,
                  durationMinutes,
                  description:
                    "Your scheduled NetQwix session. Open the NetQwix app a few minutes before the start time to join.",
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
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      Alert.alert(
        "Booking failed",
        e?.response?.data?.message ?? e?.message ?? "Could not book the session."
      );
    },
  });

  const handleSubmit = useCallback(() => {
    if (!validateCoupon()) return;
    const requiresPayment = hourlyRate > 0 && expectedPrice > 0;
    const promoMadeFree = requiresPayment && chargingPrice === 0 && !paymentIntentId;
    if (requiresPayment && !paymentIntentId && !promoMadeFree && paymentMethod !== "wallet") {
      if (payableAmount > 0) {
        Alert.alert("Payment required", "Please complete payment before requesting the session.");
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
  ]);

  const trainerTimeLabel = useMemo(() => {
    if (!selectedStart || !trainerTimezone) return null;
    return selectedStart.setZone(trainerTimezone).toFormat("h:mm a (ZZZZ)");
  }, [selectedStart, trainerTimezone]);

  const sessionTimeSummary = useMemo(() => {
    if (!selectedStart || !sessionEnd) return "";
    return `${selectedStart.toFormat("ccc, MMM d")} · ${formatDisplayTime(selectedStart)} – ${formatDisplayTime(sessionEnd)}`;
  }, [selectedStart, sessionEnd]);

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
    expectedPrice,
    payableAmount,
    hourlyRate,
    couponCode,
    setCouponCode,
    couponError,
    setCouponError,
    promoValidating,
    promoResult,
    handleApplyPromo,
    handleRemovePromo,
    visiblePromos,
    goNext,
    goBack,
    handlePaymentComplete,
    handleSubmit,
    submitIsPending: submitMutation.isPending,
    userStripeId,
    trainerStripeId,
    commission,
    paymentIntentId,
    chargingPrice,
    parseSlotTimeOnDate: (label: string) => parseSlotTimeOnDate(bookedDateIso, label, traineeTz),
  };
}
