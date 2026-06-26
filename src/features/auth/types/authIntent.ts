export type AuthIntent =
  | "book"
  | "favorite"
  | "chat"
  | "schedule"
  | "capture_upload"
  | "generic";

export type AuthScreenParams = {
  intent?: AuthIntent;
  messageKey?: string;
};

export type PendingAuthAction = {
  intent: AuthIntent;
  trainer?: Record<string, unknown>;
  bookMode?: "instant" | "schedule";
  messageKey?: string;
  /** Optional snapshot of where the user was — used to restore context. */
  context?: Record<string, unknown>;
  /** Unix ms; intents older than ~24h are discarded on hydrate. */
  t?: number;
};

export type RequireAuthOptions = {
  screen?: "Login" | "SignUp";
  intent?: AuthIntent;
  messageKey?: string;
  trainer?: Record<string, unknown>;
  bookMode?: "instant" | "schedule";
  context?: Record<string, unknown>;
};
