import React from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "../../theme";
import { WizardHeader } from "../instant-lesson/booking-wizard/WizardHeader";
import { WizardStepClips } from "../instant-lesson/booking-wizard/steps/WizardStepClips";
import { WizardStepPayment } from "../instant-lesson/booking-wizard/steps/WizardStepPayment";
import { navigateToWalletTopUp } from "../../navigation/navigationRef";
import { ScheduleStepConfirm } from "./steps/ScheduleStepConfirm";
import { ScheduleStepDateTime } from "./steps/ScheduleStepDateTime";
import { ScheduleStepDuration } from "./steps/ScheduleStepDuration";
import { ScheduleStepPromo } from "./steps/ScheduleStepPromo";
import { useScheduledBookingWizard } from "./useScheduledBookingWizard";

type Props = {
  visible: boolean;
  trainer: Record<string, unknown> | null;
  onDismiss: () => void;
  onBooked?: () => void;
};

export function ScheduledBookingWizardModal({ visible, trainer, onDismiss, onBooked }: Props) {
  const insets = useSafeAreaInsets();
  const w = useScheduledBookingWizard({ visible, trainer, onDismiss, onBooked });

  if (!trainer) return null;

  const dayMsg =
    w.dayAvailabilityQuery.data?.message ??
    (w.dayAvailabilityQuery.isError ? "Could not load availability." : undefined);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View style={[styles.shell, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <WizardHeader
          step={w.step as any}
          stepNum={w.stepNum}
          totalSteps={w.totalSteps}
          onGoBack={w.goBack}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Schedule with {w.trainerName}</Text>

          {w.step === "datetime" && (
            <ScheduleStepDateTime
              traineeTz={w.traineeTz}
              trainerTimezone={w.trainerTimezone}
              selectedDate={w.selectedDate}
              onSelectDate={w.setSelectedDate}
              startCandidates={w.startCandidates}
              selectedStartIso={w.selectedStartIso}
              onSelectStart={w.setSelectedStartIso}
              loading={w.dayAvailabilityQuery.isLoading}
              errorMessage={dayMsg}
              smartSuggestions={w.smartScheduleSuggestions}
              smartSuggestionsLoading={w.smartScheduleLoading}
              onNext={w.goNext}
            />
          )}

          {w.step === "duration" && (
            <ScheduleStepDuration
              durationMinutes={w.durationMinutes}
              onDurationChange={w.setDurationMinutes}
              hourlyRate={w.hourlyRate}
              expectedPrice={w.expectedPrice}
              durationPreviewQuote={w.durationPreviewQuote}
              sessionTimeSummary={w.sessionTimeSummary}
              trainerTimeLabel={w.trainerTimeLabel}
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

          {w.step === "promo" && (
            <ScheduleStepPromo
              couponCode={w.couponCode}
              onCouponCodeChange={w.setCouponCode}
              couponError={w.couponError}
              onCouponErrorClear={() => w.setCouponError("")}
              promoValidating={w.promoValidating}
              promoResult={w.promoResult}
              onApplyPromo={w.handleApplyPromo}
              onRemovePromo={w.handleRemovePromo}
              visiblePromos={w.visiblePromos}
              expectedPrice={w.expectedPrice}
              onNext={w.goNext}
              onSkip={w.goNext}
            />
          )}

          {w.step === "payment" && (
            <WizardStepPayment
              trainer={w.trainer}
              durationMinutes={w.durationMinutes}
              durationLabel={`${w.durationMinutes} min`}
              expectedPrice={w.expectedPrice}
              promoResult={w.promoResult}
              couponCode={w.couponCode}
              userStripeId={w.userStripeId}
              bookingType="scheduled"
              onPaymentComplete={w.handlePaymentComplete}
              onNext={w.goNext}
              onAddFunds={(shortfall) => {
                onDismiss();
                navigateToWalletTopUp(shortfall);
              }}
            />
          )}

          {w.step === "confirm" && (
            <ScheduleStepConfirm
              trainerName={w.trainerName}
              sessionTimeSummary={w.sessionTimeSummary}
              trainerTimeLabel={w.trainerTimeLabel}
              durationMinutes={w.durationMinutes}
              expectedPrice={w.expectedPrice}
              promoResult={w.promoResult}
              chargingPrice={w.chargingPrice}
              pricingQuote={w.pricingQuote}
              couponCode={w.couponCode}
              selectedClipIds={w.selectedClipIds}
              isSubmitting={w.submitIsPending}
              onSubmit={w.handleSubmit}
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: space.md,
    paddingHorizontal: space.xs,
  },
});
