export type AuthIntent = "book" | "favorite" | "chat" | "generic";

export type AuthScreenParams = {
  intent?: AuthIntent;
  messageKey?: string;
};

export type PendingAuthAction = {
  intent: AuthIntent;
  trainer?: Record<string, unknown>;
  bookMode?: "instant" | "schedule";
  messageKey?: string;
};

export type RequireAuthOptions = {
  screen?: "Login" | "SignUp";
  intent?: AuthIntent;
  messageKey?: string;
  trainer?: Record<string, unknown>;
  bookMode?: "instant" | "schedule";
};
