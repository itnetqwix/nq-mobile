import React, { useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { useAuth } from "../../auth/context/AuthContext";
import { CertificatesSetupScreen } from "./CertificatesSetupScreen";
import { WorkExperienceSetupScreen } from "./WorkExperienceSetupScreen";
import { DegreesSetupScreen } from "./DegreesSetupScreen";
import {
  getTrainerExtra,
  saveTrainerCredentials,
} from "../lib/trainerProfileSetup";
import type {
  TrainerCertificate,
  TrainerDegree,
  TrainerWorkExperience,
} from "../types/trainerCredentials";

type Step = "certificates" | "work" | "degrees";

export function ProfessionalProfileScreen() {
  const { t } = useAppTranslation();
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const extra = getTrainerExtra(user);
  const [step, setStep] = useState<Step>("certificates");
  const [certificates, setCertificates] = useState<TrainerCertificate[]>(
    extra.certificates ?? []
  );
  const [workExperience, setWorkExperience] = useState<TrainerWorkExperience[]>(
    extra.work_experience ?? []
  );
  const [degrees, setDegrees] = useState<TrainerDegree[]>(extra.degrees ?? []);
  const [saving, setSaving] = useState(false);

  const persist = async (
    nextDegrees: TrainerDegree[],
    markComplete = true
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      await saveTrainerCredentials(
        user,
        {
          certificates,
          work_experience: workExperience,
          degrees: nextDegrees,
        },
        markComplete ? { completed: true } : undefined
      );
      await refreshUser();
      Alert.alert(t("profile.savedTitle"), t("trainerProfile.savedBody"));
      navigation.goBack();
    } catch (e) {
      Alert.alert(t("profile.saveFailedTitle"), getApiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (step === "certificates") {
    return (
      <CertificatesSetupScreen
        initial={certificates}
        onSkip={() => setStep("work")}
        onNext={(items) => {
          setCertificates(items);
          setStep("work");
        }}
      />
    );
  }

  if (step === "work") {
    return (
      <WorkExperienceSetupScreen
        initial={workExperience}
        onSkip={() => setStep("degrees")}
        onNext={(items) => {
          setWorkExperience(items);
          setStep("degrees");
        }}
      />
    );
  }

  return (
    <DegreesSetupScreen
      initial={degrees}
      onSkip={() => void persist(degrees, false)}
      onFinish={(items) => {
        setDegrees(items);
        void persist(items, true);
      }}
    />
  );
}
