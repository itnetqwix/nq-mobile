import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../features/auth/context/AuthContext";
import { CertificatesSetupScreen } from "../features/trainer-profile/screens/CertificatesSetupScreen";
import { DegreesSetupScreen } from "../features/trainer-profile/screens/DegreesSetupScreen";
import { WorkExperienceSetupScreen } from "../features/trainer-profile/screens/WorkExperienceSetupScreen";
import {
  getTrainerExtra,
  saveTrainerCredentials,
} from "../features/trainer-profile/lib/trainerProfileSetup";
import type {
  TrainerCertificate,
  TrainerDegree,
  TrainerWorkExperience,
} from "../features/trainer-profile/types/trainerCredentials";
import { nestedStackScreenOptions } from "./stackTransitions";

export type TrainerProfileSetupStackParamList = {
  Certificates: undefined;
  WorkExperience: undefined;
  Degrees: undefined;
};

const Stack = createNativeStackNavigator<TrainerProfileSetupStackParamList>();

type Props = { onComplete: () => void };

export function TrainerProfileSetupNavigator({ onComplete }: Props) {
  const { user, refreshUser } = useAuth();
  const extra = getTrainerExtra(user);
  const [certificates, setCertificates] = useState<TrainerCertificate[]>(
    extra.certificates ?? []
  );
  const [workExperience, setWorkExperience] = useState<TrainerWorkExperience[]>(
    extra.work_experience ?? []
  );
  const [degrees, setDegrees] = useState<TrainerDegree[]>(extra.degrees ?? []);
  const [saving, setSaving] = useState(false);

  const persist = async (
    patch: {
      certificates?: TrainerCertificate[];
      work_experience?: TrainerWorkExperience[];
      degrees?: TrainerDegree[];
    },
    options?: { completed?: boolean; skipped?: boolean }
  ) => {
    setSaving(true);
    try {
      await saveTrainerCredentials(user, patch, options);
      await refreshUser();
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  if (saving) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={nestedStackScreenOptions()}>
      <Stack.Screen name="Certificates">
        {({ navigation }) => (
          <CertificatesSetupScreen
            initial={certificates}
            onSkip={() => void persist({}, { skipped: true })}
            onNext={(items) => {
              setCertificates(items);
              navigation.navigate("WorkExperience");
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="WorkExperience">
        {({ navigation }) => (
          <WorkExperienceSetupScreen
            initial={workExperience}
            onSkip={() => void persist({ certificates }, { skipped: true })}
            onNext={(items) => {
              setWorkExperience(items);
              navigation.navigate("Degrees");
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Degrees">
        {() => (
          <DegreesSetupScreen
            initial={degrees}
            onSkip={() =>
              void persist({ certificates, work_experience: workExperience }, { skipped: true })
            }
            onFinish={(items) =>
              void persist(
                {
                  certificates,
                  work_experience: workExperience,
                  degrees: items,
                },
                { completed: true }
              )
            }
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
