import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useThemeColors } from "../../../../theme";
import { useSharedStepStyles } from "../sharedStepStyles";

type Props = {
  onContinue: () => void;
};

export function WizardStepIntro({ onContinue }: Props) {
  const c = useThemeColors();
  const sharedStepStyles = useSharedStepStyles();
  return (
    <View style={sharedStepStyles.card}>
      <Text style={sharedStepStyles.lead}>
        You choose lesson length, optional clips, then we notify the coach
        and open the waiting flow.
      </Text>
      <Text style={sharedStepStyles.muted}>
        The coach has about two minutes to accept. You will both enter the live session when they do.
      </Text>
      <Pressable style={sharedStepStyles.primaryBtn} onPress={onContinue}>
        <Text style={sharedStepStyles.primaryBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color={c.brandTextOn} />
      </Pressable>
    </View>
  );
}
