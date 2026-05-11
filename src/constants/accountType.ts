export const AccountType = {
  TRAINER: "Trainer",
  TRAINEE: "Trainee",
} as const;

export type AccountTypeValue = (typeof AccountType)[keyof typeof AccountType];
