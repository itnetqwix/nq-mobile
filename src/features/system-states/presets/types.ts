import type { Ionicons } from "@expo/vector-icons";

export type SystemStateId =
  | "offline"
  | "maintenance"
  | "not_found"
  | "server_error"
  | "unauthorized"
  | "session_expired"
  | "subscription_expired"
  | "payment_failed"
  | "empty_dashboard"
  | "no_results"
  | "account_blocked"
  | "update_required"
  | "email_not_verified"
  | "phone_verification_pending"
  | "account_suspended"
  | "account_under_review"
  | "password_reset_success"
  | "password_reset_expired"
  | "too_many_login_attempts"
  | "device_not_recognized"
  | "trainer_not_assigned"
  | "trainer_removed_you"
  | "profile_updated"
  | "payment_success"
  | "password_changed"
  | "upload_failed"
  | "upload_processing"
  | "slow_network"
  | "api_failure"
  | "trial_expired"
  | "no_active_plan"
  | "content_removed"
  | "trainer_unavailable"
  | "geo_restricted"
  | "feature_coming_soon"
  | "service_unavailable"
  | "no_notifications"
  | "storage_limit"
  | "chat_support_offline"
  | "ai_recommendation_failed";

export type SystemStateActionId =
  | "go_home"
  | "go_back"
  | "retry"
  | "auth_login"
  | "auth_signup"
  | "contact_support"
  | "open_faq"
  | "open_settings"
  | "open_wallet"
  | "open_notifications"
  | "resend_email"
  | "verify_phone"
  | "book_lesson"
  | "open_clips"
  | "open_privacy"
  | "open_terms"
  | "open_store"
  | "toggle_remember_device"
  | "dismiss";

export type SystemStatePreset = {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  primary?: { label: string; action: SystemStateActionId };
  secondary?: { label: string; action: SystemStateActionId };
  supportLink?: boolean;
  variant?: "default" | "success" | "warning" | "danger";
};
