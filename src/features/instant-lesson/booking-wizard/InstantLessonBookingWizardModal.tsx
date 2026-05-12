import React from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "../../../theme/tokens";
import type { InstantLessonBookingWizardModalProps } from "./types";
import { useInstantLessonBookingWizard } from "./useInstantLessonBookingWizard";
import { WizardHeader } from "./WizardHeader";
import { WizardTitleBlock } from "./WizardTitleBlock";
import { WizardStepClips } from "./steps/WizardStepClips";
import { WizardStepConfirm } from "./steps/WizardStepConfirm";
import { WizardStepDuration } from "./steps/WizardStepDuration";
import { WizardStepIntro } from "./steps/WizardStepIntro";

/**
 * Trainee instant-lesson booking: multi-step flow (intro → duration → clips → confirm).
 * Orchestrates `useInstantLessonBookingWizard` + small step components under `steps/`.
 */
export function InstantLessonBookingWizardModal({ visible, trainer, onDismiss }: InstantLessonBookingWizardModalProps) {
  const insets = useSafeAreaInsets();
  const w = useInstantLessonBookingWizard({ visible, trainer, onDismiss });

  if (!trainer) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={[styles.shell, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <WizardHeader step={w.step} stepNum={w.stepNum} totalSteps={w.totalSteps} onGoBack={w.goBack} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <WizardTitleBlock trainerName={w.trainerName} />

          {w.step === "intro" && <WizardStepIntro onContinue={w.goNext} />}

          {w.step === "duration" && (
            <WizardStepDuration
              durationMinutes={w.durationMinutes}
              onDurationChange={w.setDurationMinutes}
              couponCode={w.couponCode}
              onCouponCodeChange={w.setCouponCode}
              couponError={w.couponError}
              onCouponErrorClear={() => w.setCouponError("")}
              onNext={w.goNext}
            />
          )}

          {w.step === "clips" && (
            <WizardStepClips
              clipsQuery={w.clipsQuery}
              flatClips={w.flatClips}
              selectedClipIds={w.selectedClipIds}
              onToggleClip={w.toggleClip}
              onSkip={w.goNext}
              onNext={w.goNext}
            />
          )}

          {w.step === "confirm" && (
            <WizardStepConfirm
              trainerName={w.trainerName}
              durationMinutes={w.durationMinutes}
              selectedClipIds={w.selectedClipIds}
              couponCode={w.couponCode}
              isSubmitting={w.submitIsPending}
              onSubmit={w.handleSendRequest}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: space.md, paddingBottom: space.xl },
});
