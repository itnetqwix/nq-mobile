import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
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
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { queryKeys } from "../../../lib/queryKeys";
import { colors, radii, space, typography } from "../../../theme";
import { postSignUp } from "../api/authApi";
import { fetchSportCategories } from "../api/masterApi";
import { SignupCategoryPicker } from "../components/SignupCategoryPicker";
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

type SignUpStep = "contact" | "category" | "password";

export function SignUpScreen({ navigation, route }: AuthScreenProps<"SignUp">) {
  const { t } = useAppTranslation();
  const { completeSessionFromTokens } = useAuth();
  const { showLoader, hideLoader } = useLoader();
  const isSsoSignup = Boolean(route.params?.isGoogleRegister || route.params?.ssoProvider);
  const ssoLabel =
    route.params?.ssoProvider === "apple"
      ? t("auth.ssoApple")
      : route.params?.ssoProvider === "google"
        ? t("auth.ssoGoogle")
        : t("auth.ssoGeneric");

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

  const categoriesQuery = useQuery({
    queryKey: queryKeys.master.sportCategories,
    queryFn: fetchSportCategories,
    staleTime: 1000 * 60 * 30,
  });

  const categories = categoriesQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: (payload: SignUpPayload) => postSignUp(payload),
    onSuccess: () => {
      const body =
        accountType === AccountType.TRAINER
          ? t("auth.accountCreatedTrainerBody")
          : t("auth.accountCreatedTraineeBody");
      Alert.alert(t("auth.accountCreatedTitle"), body, [
        { text: t("auth.ok"), onPress: () => navigation.navigate("Login") },
      ]);
    },
    onError: (err) => {
      Alert.alert(t("auth.signUpFailed"), getApiErrorMessage(err));
    },
  });

  const contactError = (): string | null => {
    if (!fullname.trim() || !/^[A-Za-z\s]+$/.test(fullname.trim())) {
      return t("auth.fullNameInvalid");
    }
    if (!EMAIL_RE.test(email.trim())) return t("auth.emailInvalidShort");
    if (!isSsoSignup && !emailVerified) return t("auth.verifyEmailOtp");
    if (!mobile.trim() || mobile.replace(/\D/g, "").length < 10) {
      return t("auth.phoneInvalid");
    }
    if (!phoneVerified) return t("auth.verifyPhoneOtp");
    if (!tcpa) return t("auth.tcpaRequired");
    return null;
  };

  const categoryError = (): string | null => {
    if (!category) return t("auth.chooseCategory");
    return null;
  };

  const passwordError = (): string | null => {
    const err = signupPasswordError(password);
    if (err) return t("auth.passwordMustInclude", { detail: err.toLowerCase() });
    if (password !== confirmPassword) return t("auth.passwordsMismatch");
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

  const onContinueToCategory = () => {
    const err = contactError();
    if (err) {
      Alert.alert(t("auth.checkFormTitle"), err);
      return;
    }
    setStep("category");
  };

  const onContinueFromCategory = () => {
    const err = categoryError();
    if (err) {
      Alert.alert(t("auth.checkFormTitle"), err);
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
      Alert.alert(t("auth.checkPasswordTitle"), err);
      return;
    }
    mutation.mutate(buildPayload(password, false));
  };

  const onSocialTokens = async (tokens: { access_token: string; account_type: string }) => {
    showLoader(t("auth.signingIn"));
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
        {t("auth.createAccount")}
      </Text>
      <View style={styles.stepRow}>
        <StepPill
          label={t("auth.stepContact")}
          active={step === "contact"}
          done={step === "category" || step === "password"}
        />
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        <StepPill
          label={t("auth.stepCategory")}
          active={step === "category"}
          done={step === "password"}
        />
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        <StepPill
          label={isSsoSignup ? t("auth.stepFinish") : t("auth.stepPassword")}
          active={step === "password"}
          done={false}
        />
      </View>

      {step === "contact" ? (
        <Stack gap="md">
          <SocialAuthButtons navigation={navigation} onTokens={onSocialTokens} mode="signup" />

          <FormField
            label={t("auth.fullName")}
            value={fullname}
            onChangeText={setFullname}
            autoCapitalize="words"
            required
          />

          <FormField
            label={t("auth.email")}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
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
              <Text style={styles.ssoVerifiedText}>
                {t("auth.emailVerifiedWith", { provider: ssoLabel })}
              </Text>
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
            label={t("auth.phone")}
            value={mobile}
            onChangeText={(text) => {
              setMobile(text);
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

          <Text style={styles.sectionLabel}>{t("auth.accountTypeLabel")}</Text>
          <View style={styles.row}>
            <TypeChip
              label={t("auth.trainee")}
              selected={accountType === AccountType.TRAINEE}
              onPress={() => {
                setAccountType(AccountType.TRAINEE);
              }}
            />
            <TypeChip
              label={t("auth.trainer")}
              selected={accountType === AccountType.TRAINER}
              onPress={() => setAccountType(AccountType.TRAINER)}
            />
          </View>

          <View style={styles.tcpaRow}>
            <Switch value={tcpa} onValueChange={setTcpa} />
            <Text style={styles.tcpaText}>{t("auth.tcpaConsent")}</Text>
          </View>

          <Button
            label={t("auth.continue")}
            size="lg"
            onPress={onContinueToCategory}
          />
        </Stack>
      ) : step === "category" ? (
        <Stack gap="md">
          <Pressable onPress={() => setStep("contact")} style={styles.backLink}>
            <Ionicons name="arrow-back" size={18} color={colors.brandAccent} />
            <Text style={styles.link}>{t("auth.editContactDetails")}</Text>
          </Pressable>
          <Text style={styles.sectionLabel}>
            {accountType === AccountType.TRAINER
              ? t("auth.categoryTrainerTitle")
              : t("auth.categoryTraineeTitle")}
          </Text>
          <Text style={styles.categoryHint}>{t("auth.categoryStepHint")}</Text>
          <View style={styles.categoryPickerBox}>
            <SignupCategoryPicker
              categories={categories}
              selected={category}
              onSelect={setCategory}
              loading={categoriesQuery.isLoading}
            />
          </View>
          <Button
            label={isSsoSignup ? t("auth.createAccount") : t("auth.continue")}
            size="lg"
            loading={mutation.isPending}
            onPress={onContinueFromCategory}
          />
        </Stack>
      ) : (
        <Stack gap="md">
          <Pressable onPress={() => setStep("category")} style={styles.backLink}>
            <Ionicons name="arrow-back" size={18} color={colors.brandAccent} />
            <Text style={styles.link}>{t("auth.editContactDetails")}</Text>
          </Pressable>

          <PasswordRequirements password={password} />

          <FormField
            label={t("auth.password")}
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
            label={t("auth.confirmPassword")}
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
            label={t("auth.createAccount")}
            loading={mutation.isPending}
            onPress={onSubmit}
            size="lg"
            disabled={!isSignupPasswordValid(password) || password !== confirmPassword}
          />
        </Stack>
      )}

      <Pressable onPress={() => navigation.navigate("Login")} style={styles.back}>
        <Text style={styles.link}>{t("auth.alreadyHaveAccountSignIn")}</Text>
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
  categoryHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: space.sm,
  },
  categoryPickerBox: {
    maxHeight: 360,
    marginBottom: space.md,
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
