import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import {
  Button,
  FormField,
  PasswordVisibilityToggle,
  ScreenContainer,
  Stack,
} from "../../../components/ui";
import { AccountType } from "../../../constants/accountType";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { colors, radii, space, typography } from "../../../theme";
import { postSignUp } from "../api/authApi";
import { fetchMasterRow } from "../api/masterApi";
import type { SignUpPayload } from "../api/types";
import { PasswordRequirements } from "../components/PasswordRequirements";
import { SignupInlineOtp } from "../components/SignupInlineOtp";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { useAuth } from "../context/AuthContext";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { promptEnableAppUnlock } from "../security/appUnlock";
import {
  isSignupPasswordValid,
  signupPasswordError,
} from "../utils/passwordValidation";
import type { AuthScreenProps } from "../../../navigation/types";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type SignUpStep = "contact" | "password";

export function SignUpScreen({ navigation, route }: AuthScreenProps<"SignUp">) {
  const { completeSessionFromTokens } = useAuth();
  const { showLoader, hideLoader } = useLoader();
  const isSsoSignup = Boolean(route.params?.isGoogleRegister || route.params?.ssoProvider);
  const ssoLabel =
    route.params?.ssoProvider === "apple" ? "Apple" : route.params?.ssoProvider === "google" ? "Google" : "SSO";

  const [step, setStep] = useState<SignUpStep>("contact");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState(route.params?.prefillEmail ?? "");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [accountType, setAccountType] = useState<string>(AccountType.TRAINEE);
  const [category, setCategory] = useState<string | null>(null);
  const [tcpa, setTcpa] = useState(false);

  useEffect(() => {
    if (route.params?.prefillEmail && isSsoSignup) {
      setEmail(route.params.prefillEmail);
      setEmailVerified(true);
    }
  }, [route.params?.prefillEmail, isSsoSignup]);

  const masterQuery = useQuery({
    queryKey: ["master", "row"],
    queryFn: fetchMasterRow,
    staleTime: 1000 * 60 * 30,
  });

  const categories = useMemo(() => {
    const list = masterQuery.data?.category;
    return Array.isArray(list) ? list : [];
  }, [masterQuery.data]);

  const mutation = useMutation({
    mutationFn: (payload: SignUpPayload) => postSignUp(payload),
    onSuccess: () => {
      const body =
        accountType === AccountType.TRAINER
          ? "Sign in to complete trainer verification (contact, profile, and face check) in the app."
          : "You can sign in now.";
      Alert.alert("Account created", body, [{ text: "OK", onPress: () => navigation.navigate("Login") }]);
    },
    onError: (err) => {
      Alert.alert("Sign up failed", getApiErrorMessage(err));
    },
  });

  const contactError = (): string | null => {
    if (!fullname.trim() || !/^[A-Za-z\s]+$/.test(fullname.trim())) {
      return "Enter your full name (letters only).";
    }
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email.";
    if (!isSsoSignup && !emailVerified) return "Verify your email with the OTP we send.";
    if (!mobile.trim() || mobile.replace(/\D/g, "").length < 10) {
      return "Enter a valid phone number.";
    }
    if (!phoneVerified) return "Verify your phone with the SMS OTP.";
    if (accountType === AccountType.TRAINER && !category) return "Choose a trainer category.";
    if (!tcpa) return "Please accept SMS/email notifications to continue.";
    return null;
  };

  const passwordError = (): string | null => {
    const err = signupPasswordError(password);
    if (err) return `Password must include: ${err.toLowerCase()}.`;
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  const buildPayload = (usePassword: string, googleRegister?: boolean): SignUpPayload => ({
    fullname: fullname.trim(),
    email: email.trim(),
    password: usePassword,
    mobile_no: mobile.trim(),
    account_type: accountType,
    category: accountType === AccountType.TRAINER ? category : undefined,
    tcpa: true,
    isGoogleRegister: googleRegister,
  });

  const onContinueToPassword = () => {
    const err = contactError();
    if (err) {
      Alert.alert("Check form", err);
      return;
    }
    if (isSsoSignup) {
      mutation.mutate(buildPayload("*****", true));
      return;
    }
    setStep("password");
  };

  const onSubmit = () => {
    const err = passwordError();
    if (err) {
      Alert.alert("Check password", err);
      return;
    }
    mutation.mutate(buildPayload(password, false));
  };

  const onSocialTokens = async (tokens: { access_token: string; account_type: string }) => {
    showLoader("Signing you in…");
    try {
      await completeSessionFromTokens(tokens);
      await promptEnableAppUnlock();
    } finally {
      hideLoader();
    }
  };

  return (
    <ScreenContainer scroll applyTopInset padding="lg" background={colors.background}>
      <View style={styles.brand}>
        <NetqwixLogo maxWidth={220} />
      </View>
      <Text style={[typography.titleLg, { color: colors.text, marginTop: space.md }]}>
        Create account
      </Text>
      <View style={styles.stepRow}>
        <StepPill label="1. Contact" active={step === "contact"} done={step === "password"} />
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        <StepPill
          label={isSsoSignup ? "2. Finish" : "2. Password"}
          active={step === "password"}
          done={false}
        />
      </View>

      {step === "contact" ? (
        <Stack gap="md">
          <SocialAuthButtons navigation={navigation} onTokens={onSocialTokens} mode="signup" />

          <FormField
            label="Full name"
            value={fullname}
            onChangeText={setFullname}
            autoCapitalize="words"
            required
          />

          <FormField
            label="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setEmailVerified(false);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!emailVerified && !isSsoSignup}
            required
          />
          {isSsoSignup && emailVerified ? (
            <View style={styles.ssoVerified}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.ssoVerifiedText}>Email verified with {ssoLabel}</Text>
            </View>
          ) : (
            <SignupInlineOtp
              channel="email"
              email={email}
              verified={emailVerified}
              onVerified={() => setEmailVerified(true)}
            />
          )}

          <FormField
            label="Phone"
            value={mobile}
            onChangeText={(t) => {
              setMobile(t);
              setPhoneVerified(false);
            }}
            keyboardType="phone-pad"
            editable={!phoneVerified}
            required
          />
          <SignupInlineOtp
            channel="sms"
            mobile={mobile}
            disabled={!emailVerified}
            verified={phoneVerified}
            onVerified={() => setPhoneVerified(true)}
          />

          <Text style={styles.sectionLabel}>Account type</Text>
          <View style={styles.row}>
            <TypeChip
              label="Trainee"
              selected={accountType === AccountType.TRAINEE}
              onPress={() => {
                setAccountType(AccountType.TRAINEE);
                setCategory(null);
              }}
            />
            <TypeChip
              label="Trainer"
              selected={accountType === AccountType.TRAINER}
              onPress={() => setAccountType(AccountType.TRAINER)}
            />
          </View>

          {accountType === AccountType.TRAINER ? (
            <>
              <Text style={styles.sectionLabel}>Category</Text>
              {masterQuery.isLoading ? (
                <Text style={styles.muted}>Loading categories…</Text>
              ) : (
                <View style={styles.wrapChips}>
                  {categories.map((c) => (
                    <TypeChip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
                  ))}
                </View>
              )}
            </>
          ) : null}

          <View style={styles.tcpaRow}>
            <Switch value={tcpa} onValueChange={setTcpa} />
            <Text style={styles.tcpaText}>
              I agree to receive SMS and emails from NetQwix for alerts and notifications.
            </Text>
          </View>

          <Button
            label={isSsoSignup ? "Create account" : "Continue"}
            size="lg"
            loading={mutation.isPending}
            onPress={onContinueToPassword}
          />
        </Stack>
      ) : (
        <Stack gap="md">
          <Pressable onPress={() => setStep("contact")} style={styles.backLink}>
            <Ionicons name="arrow-back" size={18} color={colors.brandAccent} />
            <Text style={styles.link}>Edit contact details</Text>
          </Pressable>

          <PasswordRequirements password={password} />

          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            required
            trailing={
              <PasswordVisibilityToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            }
          />
          <FormField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            autoCorrect={false}
            required
            trailing={
              <PasswordVisibilityToggle visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
            }
          />

          <Button
            label="Create account"
            loading={mutation.isPending}
            onPress={onSubmit}
            size="lg"
            disabled={!isSignupPasswordValid(password) || password !== confirmPassword}
          />
        </Stack>
      )}

      <Pressable onPress={() => navigation.navigate("Login")} style={styles.back}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </ScreenContainer>
  );
}

function StepPill({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <View
      style={[
        styles.pill,
        active && styles.pillActive,
        done && !active && styles.pillDone,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          (active || done) && styles.pillTextActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function TypeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginTop: space.lg },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginVertical: space.md,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.brandAccentSubtle,
    borderColor: colors.brandAccent,
  },
  pillDone: {
    borderColor: colors.success,
  },
  pillText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  pillTextActive: { color: colors.brandNavy },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: space.sm,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    gap: space.sm,
    marginBottom: space.md,
    flexWrap: "wrap",
  },
  wrapChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginBottom: space.md,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipSelected: {
    borderColor: colors.brandAccent,
    backgroundColor: colors.brandAccentSubtle,
  },
  chipText: {
    color: colors.text,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: colors.brandAccent,
  },
  muted: {
    color: colors.textMuted,
    marginBottom: space.md,
  },
  tcpaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    marginVertical: space.md,
  },
  tcpaText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: space.sm,
  },
  back: {
    marginTop: space.lg,
    alignItems: "center",
  },
  link: {
    color: colors.brandAccent,
    fontWeight: "600",
  },
  ssoVerified: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
    marginBottom: space.sm,
  },
  ssoVerifiedText: {
    color: colors.success,
    fontWeight: "600",
    fontSize: 14,
  },
});
