import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { NetqwixLogo } from "../../../components/brand/NetqwixLogo";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { TextField } from "../../../components/ui/TextField";
import { AccountType } from "../../../constants/accountType";
import { getApiErrorMessage } from "../../../lib/http/getApiErrorMessage";
import { colors, radii, space } from "../../../theme/tokens";
import { postSignUp } from "../api/authApi";
import { fetchMasterRow } from "../api/masterApi";
import type { SignUpPayload } from "../api/types";
import type { AuthScreenProps } from "../../../navigation/types";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function SignUpScreen({ navigation }: AuthScreenProps<"SignUp">) {
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [accountType, setAccountType] = useState<string>(AccountType.TRAINEE);
  const [category, setCategory] = useState<string | null>(null);
  const [tcpa, setTcpa] = useState(false);

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
          ? "You can sign in here. If the website required KYC or Stripe onboarding, finish that there when prompted."
          : "You can sign in now.";
      Alert.alert("Account created", body, [{ text: "OK", onPress: () => navigation.navigate("Login") }]);
    },
    onError: (err) => {
      Alert.alert("Sign up failed", getApiErrorMessage(err));
    },
  });

  const validationError = (): string | null => {
    if (!fullname.trim() || !/^[A-Za-z\s]+$/.test(fullname.trim())) {
      return "Enter your full name (letters only).";
    }
    if (!EMAIL_RE.test(email.trim())) return "Enter a valid email.";
    if (password.length < 6 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      return "Password: 6+ chars with letters and a number.";
    }
    if (!mobile.trim()) return "Enter your phone number.";
    if (accountType === AccountType.TRAINER && !category) return "Choose a trainer category.";
    if (!tcpa) return "Please accept SMS/email notifications to continue.";
    return null;
  };

  const onSubmit = () => {
    const err = validationError();
    if (err) {
      Alert.alert("Check form", err);
      return;
    }
    const payload: SignUpPayload = {
      fullname: fullname.trim(),
      email: email.trim(),
      password,
      mobile_no: mobile.trim(),
      account_type: accountType,
      category: accountType === AccountType.TRAINER ? category : undefined,
      tcpa: true,
    };
    mutation.mutate(payload);
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <NetqwixLogo maxWidth={220} />
        <Text style={styles.headline}>Create account</Text>
        <Text style={styles.sub}>Same details as the NetQwix website.</Text>

        <TextField label="Full name" value={fullname} onChangeText={setFullname} autoCapitalize="words" />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <TextField label="Phone" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />

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

        <Button title="Create account" loading={mutation.isPending} onPress={onSubmit} />
        <Pressable onPress={() => navigation.navigate("Login")} style={styles.back}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
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
  headline: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  sub: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: space.lg,
  },
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
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: "#eff6ff",
  },
  chipText: {
    color: colors.text,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: colors.primary,
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
  back: {
    marginTop: space.lg,
    alignItems: "center",
  },
  link: {
    color: colors.primary,
    fontWeight: "600",
  },
});
