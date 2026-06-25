import React from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "../../theme";
import { keyboardAvoidingBehavior, useKeyboardScrollPadding } from "../../lib/keyboard";
import { WizardHeader } from "../instant-lesson/booking-wizard/WizardHeader";
import { WizardStepClips } from "../instant-lesson/booking-wizard/steps/WizardStepClips";
import { WizardStepPayment } from "../instant-lesson/booking-wizard/steps/WizardStepPayment";
import { navigateToWalletSecurity, navigateToWalletTopUp } from "../../navigation/navigationRef";
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
  const scrollBottomPad = useKeyboardScrollPadding(space.xl);
  const w = useScheduledBookingWizard({ visible, trainer, onDismiss, onBooked });

  if (!trainer) return null;

  const dayMsg =
    w.dayAvailabilityQuery.data?.message ??
    (w.dayAvailabilityQuery.isError ? "Could not load availability." : undefined);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onDismiss}>
      <View
        testID="scheduled-booking-wizard"
        style={[styles.shell, { paddingTop: insets.top + 8 }]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={keyboardAvoidingBehavior()}
          keyboardVerticalOffset={insets.top + 8}
        >
          <WizardHeader
            step={w.step as any}
            stepNum={w.stepNum}
            totalSteps={w.totalSteps}
            onGoBack={w.goBack}
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
          {w.step !== "datetime" &&
          w.step !== "duration" &&
          w.step !== "confirm" &&
          w.step !== "promo" ? (
            <Text style={styles.title}>Schedule with {w.trainerName}</Text>
          ) : null}

          {w.step === "datetime" && (
            <ScheduleStepDateTime
              trainerId={w.trainerId}
              trainerName={w.trainerName}
              traineeTz={w.traineeTz}
              trainerTimezone={w.trainerTimezone}
              selectedDate={w.selectedDate}
              onSelectDate={w.setSelectedDate}
              durationMinutes={w.durationMinutes}
              onDurationChange={w.setDurationMinutes}
              availableDurations={w.durationsForPicker}
              startCandidates={w.startCandidates}
              selectedStartIso={w.selectedStartIso}
              onSelectStart={w.setSelectedStartIso}
              loading={w.dayAvailabilityQuery.isLoading}
              errorMessage={dayMsg}
              smartSuggestions={w.smartScheduleSuggestions}
              smartSuggestionsLoading={w.smartScheduleLoading}
              onApplySuggestion={w.applySmartSuggestion}
              onNext={w.goNext}
              stepTransitioning={w.stepTransitioning}
            />
          )}

          {w.step === "duration" && (
            <ScheduleStepDuration
              durationMinutes={w.durationMinutes}
              onDurationChange={w.setDurationMinutes}
              availableDurations={w.availableDurations}
              hourlyRate={w.hourlyRate}
              expectedPrice={w.expectedPrice}
              durationPreviewQuote={w.durationPreviewQuote}
              sessionTimeSummary={w.sessionTimeSummary}
              trainerTimeLabel={w.trainerTimeLabel}
              onPickAnotherTime={w.returnToDateTime}
              onNext={w.goNext}
              stepTransitioning={w.stepTransitioning}
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
              sessionTimeSummary={w.sessionTimeSummary}
              onNext={w.goNext}
              onSkip={w.goNext}
              stepTransitioning={w.stepTransitioning}
            />
          )}

          {w.step === "payment" && (
            <WizardStepPayment
              trainer={w.trainer}
              durationMinutes={w.durationMinutes}
              durationLabel={`${w.durationMinutes} min`}
              expectedPrice={w.expectedPrice}
              payableAmount={w.payableAmount}
              promoDiscountAmount={w.promoDiscountAmount}
              promoSponsorType={w.promoSponsorType}
              promoLabel={w.promoLabel}
              promoResult={w.promoResult}
              couponCode={w.couponCode}
              userStripeId={w.userStripeId}
              bookingType="scheduled"
              onPaymentComplete={w.handlePaymentComplete}
              onNext={w.advanceFromPayment}
              onAddFunds={(shortfall) => {
                onDismiss();
                navigateToWalletTopUp(shortfall);
              }}
              onSetupPin={() => {
                onDismiss();
                navigateToWalletSecurity();
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
              promoDiscountAmount={w.promoDiscountAmount}
              promoLabel={w.promoLabel}
              chargingPrice={w.chargingPrice}
              pricingQuote={w.pricingQuote}
              couponCode={w.couponCode}
              selectedClipIds={w.selectedClipIds}
              isSubmitting={w.submitIsPending}
              onSubmit={w.handleSubmit}
            />
          )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
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
