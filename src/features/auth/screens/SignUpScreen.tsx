import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
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
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { queryKeys } from "../../../lib/queryKeys";
import { colors, radii, space, typography } from "../../../theme";
import { postSignUp } from "../api/authApi";
import { postAppleVerify, postGoogleVerify } from "../api/socialAuth";
import { fetchSportCategories } from "../api/masterApi";
import { SignupCategoryPicker } from "../components/SignupCategoryPicker";
import type { SignUpPayload } from "../api/types";
import { PasswordRequirements } from "../components/PasswordRequirements";
import { AuthEscapeLink } from "../components/AuthEscapeLink";
import { AuthModalChrome } from "../components/AuthModalChrome";
import { SignupInlineOtp } from "../components/SignupInlineOtp";
import { LegalTermsAcceptance } from "../components/LegalTermsAcceptance";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { useAuth } from "../context/AuthContext";
import { useLoader } from "../../../components/brand/LoaderProvider";
import { promptEnableAppUnlock } from "../security/appUnlock";
import {
  isSignupPasswordValid,
  signupPasswordError,
} from "../utils/passwordValidation";
import type { AuthScreenProps } from "../../../navigation/types";
import { useReferralSignupParams } from "../../referral/hooks/useReferralSignupParams";
import { fetchReferralResolve } from "../../referral/api/referralApi";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

type SignUpStep = "accountType" | "category" | "profile" | "verify" | "password";

const STEP_ORDER: SignUpStep[] = ["accountType", "category", "profile", "verify", "password"];

export function SignUpScreen({ navigation, route }: AuthScreenProps<"SignUp">) {
  const { t } = useAppTranslation();
  const { signIn, completeSessionFromTokens } = useAuth();
  const { showLoader, hideLoader } = useLoader();
  const isSsoSignup = Boolean(route.params?.isGoogleRegister || route.params?.ssoProvider);
  const ssoLabel =
    route.params?.ssoProvider === "apple"
      ? t("auth.ssoApple")
      : route.params?.ssoProvider === "google"
        ? t("auth.ssoGoogle")
        : t("auth.ssoGeneric");

  const [step, setStep] = useState<SignUpStep>(isSsoSignup ? "accountType" : "accountType");
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
  const [acceptedTermsAndPrivacy, setAcceptedTermsAndPrivacy] = useState(false);
  const deepReferral = useReferralSignupParams();
  const referralCodeParam = (
    route.params?.referralCode ?? deepReferral.referralCode
  )
    ?.trim()
    .toUpperCase();
  const referrerIdParam = (route.params?.referrerId ?? deepReferral.referrerId)?.trim();

  const referralResolveQuery = useQuery({
    queryKey: ["referralResolve", referralCodeParam, referrerIdParam],
    queryFn: async () => {
      if (referralCodeParam) return fetchReferralResolve(referralCodeParam);
      return null;
    },
    enabled: Boolean(referralCodeParam),
    staleTime: 300_000,
  });

  useEffect(() => {
    if (route.params?.prefillEmail && isSsoSignup) {
      setEmail(route.params.prefillEmail);
      setEmailVerified(true);
    }
  }, [route.params?.prefillEmail, isSsoSignup]);

  const isTrainerAccount = accountType === AccountType.TRAINER;

  const categoriesQuery = useQuery({
    queryKey: queryKeys.master.sportCategories,
    queryFn: fetchSportCategories,
    staleTime: 1000 * 60 * 30,
    enabled: isTrainerAccount,
  });

  const categories = categoriesQuery.data ?? [];
  const [submitting, setSubmitting] = useState(false);

  const visibleSteps = useMemo(() => {
    const base = isSsoSignup ? STEP_ORDER.filter((s) => s !== "password") : STEP_ORDER;
    return isTrainerAccount ? base : base.filter((s) => s !== "category");
  }, [isSsoSignup, isTrainerAccount]);

  const goBack = () => {
    const idx = visibleSteps.indexOf(step);
    if (idx > 0) setStep(visibleSteps[idx - 1]);
    else navigation.navigate("Login");
  };

  const signInAfterSignup = async (payload: SignUpPayload, loginPassword: string) => {
    await postSignUp(payload);
    await signIn(payload.email.trim().toLowerCase(), loginPassword);
    await promptEnableAppUnlock();
  };

  const signInAfterSsoSignup = async (payload: SignUpPayload) => {
    await postSignUp(payload);
    const emailNorm = payload.email.trim().toLowerCase();
    if (route.params?.googleIdToken) {
      const result = await postGoogleVerify({
        email: emailNorm,
        id_token: route.params.googleIdToken,
      });
      if (result.kind !== "tokens") {
        throw new Error(t("auth.signUpSsoLoginFailed"));
      }
      await completeSessionFromTokens(result);
    } else if (route.params?.appleIdentityToken) {
      const result = await postAppleVerify({
        email: emailNorm,
        identity_token: route.params.appleIdentityToken,
      });
      if (result.kind !== "tokens") {
        throw new Error(t("auth.signUpSsoLoginFailed"));
      }
      await completeSessionFromTokens(result);
    } else {
      throw new Error(t("auth.signUpSsoLoginFailed"));
    }
    await promptEnableAppUnlock();
  };

  const runSignup = async (
    payload: SignUpPayload,
    mode: "password" | "sso",
    loginPassword?: string
  ) => {
    setSubmitting(true);
    showLoader(t("auth.creatingAccount"));
    try {
      if (mode === "sso") {
        await signInAfterSsoSignup(payload);
      } else if (loginPassword) {
        await signInAfterSignup(payload, loginPassword);
      }
    } catch (err) {
      Alert.alert(t("auth.signUpFailed"), getApiErrorMessage(err));
    } finally {
      hideLoader();
      setSubmitting(false);
    }
  };

  const profileError = (): string | null => {
    if (!fullname.trim() || !/^[A-Za-z\s]+$/.test(fullname.trim())) {
      return t("auth.fullNameInvalid");
    }
    if (!EMAIL_RE.test(email.trim())) return t("auth.emailInvalidShort");
    if (!mobile.trim() || mobile.replace(/\D/g, "").length < 10) {
      return t("auth.phoneInvalid");
    }
    return null;
  };

  const verifyError = (): string | null => {
    if (!isSsoSignup && !emailVerified) return t("auth.verifyEmailOtp");
    if (!phoneVerified) return t("auth.verifyPhoneOtp");
    if (!acceptedTermsAndPrivacy) return t("auth.legalTermsRequired");
    if (!tcpa) return t("auth.tcpaRequired");
    return null;
  };

  const categoryError = (): string | null => {
    if (!isTrainerAccount) return null;
    if (!category) return t("auth.chooseCategory");
    return null;
  };

  const passwordErrorMsg = (): string | null => {
    const err = signupPasswordError(password);
    if (err) return t("auth.passwordMustInclude", { detail: err.toLowerCase() });
    if (password !== confirmPassword) return t("auth.passwordsMismatch");
    if (!acceptedTermsAndPrivacy) return t("auth.legalTermsRequired");
    if (!tcpa) return t("auth.tcpaRequired");
    return null;
  };

  const buildPayload = (usePassword: string, googleRegister?: boolean): SignUpPayload => ({
    fullname: fullname.trim(),
    email: email.trim(),
    password: usePassword,
    mobile_no: mobile.trim(),
    account_type: accountType,
    category: isTrainerAccount ? (category ?? undefined) : undefined,
    tcpa,
    accepted_terms_and_privacy: acceptedTermsAndPrivacy,
    isGoogleRegister: googleRegister,
    ...(referralCodeParam ? { referral_code: referralCodeParam } : {}),
    ...(referrerIdParam ? { referrer_id: referrerIdParam } : {}),
  });

  const onContinueFromAccountType = () => {
    setStep(isTrainerAccount ? "category" : "profile");
  };

  const onContinueFromCategory = () => {
    const err = categoryError();
    if (err) {
      Alert.alert(t("auth.checkFormTitle"), err);
      return;
    }
    setStep("profile");
  };

  const onContinueFromProfile = () => {
    const err = profileError();
    if (err) {
      Alert.alert(t("auth.checkFormTitle"), err);
      return;
    }
    setStep("verify");
  };

  const onContinueFromVerify = () => {
    const err = verifyError();
    if (err) {
      Alert.alert(t("auth.checkFormTitle"), err);
      return;
    }
    if (isSsoSignup) {
      void runSignup(buildPayload("*****", true), "sso");
      return;
    }
    setStep("password");
  };

  const onSubmit = () => {
    const err = passwordErrorMsg();
    if (err) {
      Alert.alert(t("auth.checkPasswordTitle"), err);
      return;
    }
    void runSignup(buildPayload(password, false), "password", password);
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
    <AuthModalChrome>
      <ScreenContainer
        scroll
        applyTopInset={false}
        applyBottomInset={false}
        padding="lg"
        background={colors.background}
        contentStyle={styles.scrollContent}
      >
        <View style={styles.brand}>
          <NetqwixLogo maxWidth={220} />
        </View>
        <Text style={[typography.titleLg, { color: colors.text, marginTop: space.sm }]}>
          {t("auth.createAccount")}
        </Text>
        {referralResolveQuery.data?.referrerName ? (
          <View style={styles.referralBanner}>
            <Text style={styles.referralBannerText}>
              {t("auth.referredBy", {
                defaultValue: "Referred by {{name}}",
                name: referralResolveQuery.data.referrerName,
              })}
            </Text>
          </View>
        ) : null}
        <View style={styles.stepRow}>
          {visibleSteps.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 ? (
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              ) : null}
              <StepPill
                label={stepLabel(t, s, isSsoSignup)}
                active={step === s}
                done={visibleSteps.indexOf(step) > i}
              />
            </React.Fragment>
          ))}
        </View>

        {step !== "accountType" ? (
          <Pressable onPress={goBack} style={styles.backLink}>
            <Ionicons name="arrow-back" size={18} color={colors.brandAccent} />
            <Text style={styles.link}>{t("common.back")}</Text>
          </Pressable>
        ) : (
          <AuthEscapeLink
            variant="signin"
            onNavigateToLogin={() => navigation.navigate("Login")}
          />
        )}

        {step === "accountType" ? (
          <Stack gap="md">
            <Text style={styles.sectionLabel}>{t("auth.accountTypeLabel")}</Text>
            <Text style={styles.categoryHint}>{t("auth.accountTypeStepHint")}</Text>
            <View style={styles.row}>
              <TypeChip
                label={t("auth.trainee")}
                selected={accountType === AccountType.TRAINEE}
                onPress={() => {
                  setAccountType(AccountType.TRAINEE);
                  setCategory(null);
                }}
              />
              <TypeChip
                label={t("auth.trainer")}
                selected={accountType === AccountType.TRAINER}
                onPress={() => setAccountType(AccountType.TRAINER)}
              />
            </View>
            <Button label={t("auth.continue")} size="lg" onPress={onContinueFromAccountType} />
          </Stack>
        ) : null}

        {step === "category" && isTrainerAccount ? (
          <Stack gap="md">
            <Text style={styles.sectionLabel}>{t("auth.categoryTrainerTitle")}</Text>
            <Text style={styles.categoryHint}>{t("auth.categoryStepHint")}</Text>
            <View style={styles.categoryPickerBox}>
              <SignupCategoryPicker
                categories={categories}
                selected={category}
                onSelect={setCategory}
                loading={categoriesQuery.isLoading}
              />
            </View>
            <Button label={t("auth.continue")} size="lg" onPress={onContinueFromCategory} />
          </Stack>
        ) : null}

        {step === "profile" ? (
          <Stack gap="md">
            {!isSsoSignup ? (
              <SocialAuthButtons
                navigation={navigation as never}
                onTokens={onSocialTokens}
                mode="signup"
              />
            ) : null}
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
              editable={!isSsoSignup}
              required
            />
            {isSsoSignup && emailVerified ? (
              <View style={styles.ssoVerified}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.ssoVerifiedText}>
                  {t("auth.emailVerifiedWith", { provider: ssoLabel })}
                </Text>
              </View>
            ) : null}
            <FormField
              label={t("auth.phone")}
              value={mobile}
              onChangeText={(text) => {
                setMobile(text);
                setPhoneVerified(false);
              }}
              keyboardType="phone-pad"
              required
            />
            <Button label={t("auth.continue")} size="lg" onPress={onContinueFromProfile} />
          </Stack>
        ) : null}

        {step === "verify" ? (
          <Stack gap="md">
            <Text style={styles.categoryHint}>{t("auth.verifyStepHint")}</Text>
            {!isSsoSignup ? (
              <>
                <SignupInlineOtp
                  channel="email"
                  email={email}
                  verified={emailVerified}
                  onVerified={() => setEmailVerified(true)}
                />
                <SignupInlineOtp
                  channel="sms"
                  mobile={mobile}
                  disabled={!emailVerified}
                  verified={phoneVerified}
                  onVerified={() => setPhoneVerified(true)}
                />
              </>
            ) : (
              <SignupInlineOtp
                channel="sms"
                mobile={mobile}
                verified={phoneVerified}
                onVerified={() => setPhoneVerified(true)}
              />
            )}
            {isSsoSignup ? (
              <>
                <LegalTermsAcceptance
                  value={acceptedTermsAndPrivacy}
                  onValueChange={setAcceptedTermsAndPrivacy}
                />
                <View style={styles.tcpaRow}>
                  <Switch value={tcpa} onValueChange={setTcpa} />
                  <Text style={styles.tcpaText}>{t("auth.tcpaConsent")}</Text>
                </View>
              </>
            ) : null}
            <Button
              label={isSsoSignup ? t("auth.createAccount") : t("auth.continue")}
              size="lg"
              loading={submitting && isSsoSignup}
              onPress={onContinueFromVerify}
            />
          </Stack>
        ) : null}

        {step === "password" ? (
          <Stack gap="md">
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
                <PasswordVisibilityToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
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
                <PasswordVisibilityToggle
                  visible={showConfirm}
                  onToggle={() => setShowConfirm((v) => !v)}
                />
              }
            />
            <LegalTermsAcceptance
              value={acceptedTermsAndPrivacy}
              onValueChange={setAcceptedTermsAndPrivacy}
            />
            <View style={styles.tcpaRow}>
              <Switch value={tcpa} onValueChange={setTcpa} />
              <Text style={styles.tcpaText}>{t("auth.tcpaConsent")}</Text>
            </View>
            <Button
              label={t("auth.createAccount")}
              loading={submitting}
              onPress={onSubmit}
              size="lg"
              disabled={!isSignupPasswordValid(password) || password !== confirmPassword}
            />
          </Stack>
        ) : null}

        <Pressable onPress={() => navigation.navigate("Login")} style={styles.back}>
          <Text style={styles.link}>{t("auth.alreadyHaveAccountSignIn")}</Text>
        </Pressable>
      </ScreenContainer>
    </AuthModalChrome>
  );
}

function stepLabel(
  t: (key: string) => string,
  step: SignUpStep,
  isSso: boolean
): string {
  switch (step) {
    case "accountType":
      return t("auth.stepAccountType");
    case "category":
      return t("auth.stepCategory");
    case "profile":
      return t("auth.stepProfile");
    case "verify":
      return t("auth.stepVerify");
    case "password":
      return isSso ? t("auth.stepFinish") : t("auth.stepPassword");
    default:
      return step;
  }
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
      <Text style={[styles.pillText, (active || done) && styles.pillTextActive]}>{label}</Text>
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
  scrollContent: { flexGrow: 1 },
  referralBanner: {
    marginTop: space.sm,
    padding: space.sm,
    borderRadius: radii.md,
    backgroundColor: colors.brandAccentSubtle,
    borderWidth: 1,
    borderColor: colors.brandAccent,
  },
  referralBannerText: {
    ...typography.bodySm,
    color: colors.brandNavy,
    fontWeight: "600",
  },
  brand: { alignItems: "center", marginTop: space.xs },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.xs,
    marginVertical: space.md,
  },
  pill: {
    paddingHorizontal: 10,
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
  pillDone: { borderColor: colors.success },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
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
  chip: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
  },
  chipSelected: {
    borderColor: colors.brandAccent,
    backgroundColor: colors.brandAccentSubtle,
  },
  chipText: { color: colors.text, fontWeight: "600" },
  chipTextSelected: { color: colors.brandAccent },
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
  back: { marginTop: space.lg, alignItems: "center" },
  link: { color: colors.brandAccent, fontWeight: "600" },
  ssoVerified: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.sm,
  },
  ssoVerifiedText: { color: colors.success, fontWeight: "600", fontSize: 14 },
});
