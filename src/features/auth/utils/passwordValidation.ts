export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

export const SIGNUP_PASSWORD_RULES: PasswordRule[] = [
  { id: "len", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { id: "special", label: "One special character (!@#$…)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function isSignupPasswordValid(password: string): boolean {
  return SIGNUP_PASSWORD_RULES.every((r) => r.test(password));
}

export function signupPasswordError(password: string): string | null {
  const failed = SIGNUP_PASSWORD_RULES.find((r) => !r.test(password));
  return failed ? failed.label : null;
}
