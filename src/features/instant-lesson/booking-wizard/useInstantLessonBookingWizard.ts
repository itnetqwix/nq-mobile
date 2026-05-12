import { useMutation, useQuery } from "@tanstack/react-query";
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
import { parseInstantBookingLessonId } from "./parseInstantBookingLessonId";
import type { WizardStep, WizardTrainer } from "./types";

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
  const { startBooking } = useInstantLesson();

  const [step, setStep] = useState<WizardStep>("intro");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);

  const tid = trainerIdOf(trainer);
  const tname = trainerNameOf(trainer);

  const resetWizard = useCallback(() => {
    setStep("intro");
    setDurationMinutes(30);
    setCouponCode("");
    setCouponError("");
    setSelectedClipIds([]);
  }, []);

  useEffect(() => {
    if (!visible) resetWizard();
  }, [visible, resetWizard]);

  const clipsQuery = useQuery({
    queryKey: ["instantBookingWizardClips"],
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

  const goNext = useCallback(() => {
    const i = wizardStepIndex(step);
    if (step === "duration" && !validateCoupon()) return;
    if (i < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[i + 1]!);
  }, [step, validateCoupon]);

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
      const res = await apiClient.post(API_ROUTES.trainee.bookInstantMeeting, {
        trainer_id: tid,
        booked_date: new Date().toISOString(),
      });
      const lessonId = parseInstantBookingLessonId(res);
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
      });
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
    submitMutation.mutate();
  }, [validateCoupon, submitMutation]);

  const stepNum = wizardStepIndex(step) + 1;
  const totalSteps = WIZARD_STEPS.length;

  return {
    step,
    stepNum,
    totalSteps,
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
  };
}
