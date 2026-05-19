import type { SystemStateId, SystemStatePreset } from "./types";

export const systemStateRegistry: Record<SystemStateId, SystemStatePreset> = {
  offline: {
    title: "You're offline",
    description:
      "Check your Wi‑Fi or cellular connection, then try again.",
    icon: "cloud-offline-outline",
    primary: { label: "Try again", action: "retry" },
    secondary: { label: "Contact support", action: "contact_support" },
    supportLink: true,
  },
  maintenance: {
    title: "We're improving the platform",
    description:
      "NetQwix is briefly unavailable while we perform maintenance. Please check back shortly.",
    icon: "construct-outline",
    primary: { label: "Try again", action: "retry" },
    supportLink: true,
  },
  not_found: {
    title: "Page not found",
    description: "This screen or resource is no longer available.",
    icon: "search-outline",
    primary: { label: "Go to home", action: "go_home" },
  },
  server_error: {
    title: "Something went wrong on our side",
    description:
      "We couldn't complete your request. Please try again in a moment.",
    icon: "alert-circle-outline",
    primary: { label: "Try again", action: "retry" },
    secondary: { label: "Contact support", action: "contact_support" },
    supportLink: true,
    variant: "danger",
  },
  unauthorized: {
    title: "Access denied",
    description: "You don't have permission to view this page.",
    icon: "lock-closed-outline",
    primary: { label: "Go to home", action: "go_home" },
    secondary: { label: "Contact support", action: "contact_support" },
  },
  session_expired: {
    title: "Your session has expired. Please login again.",
    description: "For your security, sign in again to continue.",
    icon: "log-in-outline",
    primary: { label: "Login", action: "auth_login" },
    secondary: { label: "Remember this device", action: "toggle_remember_device" },
  },
  subscription_expired: {
    title: "Subscription expired",
    description: "Renew your plan to keep booking lessons and using premium features.",
    icon: "card-outline",
    primary: { label: "Renew subscription", action: "open_wallet" },
    secondary: { label: "Contact support", action: "contact_support" },
  },
  payment_failed: {
    title: "Payment failed",
    description:
      "Your card may have been declined or the payment timed out. Please try again.",
    icon: "close-circle-outline",
    primary: { label: "Try again", action: "open_wallet" },
    secondary: { label: "Contact support", action: "contact_support" },
    variant: "danger",
  },
  empty_dashboard: {
    title: "Welcome to NetQwix",
    description:
      "Your dashboard will fill up once you book lessons, add clips, or connect with your coach.",
    icon: "home-outline",
    primary: { label: "Book a lesson", action: "book_lesson" },
    secondary: { label: "Explore clips", action: "open_clips" },
  },
  no_results: {
    title: "No results found",
    description: "Try different keywords or clear your filters.",
    icon: "filter-outline",
    primary: { label: "Go back", action: "go_back" },
  },
  account_blocked: {
    title: "Account restricted",
    description:
      "You can't access this person right now. If you think this is a mistake, contact support.",
    icon: "ban-outline",
    primary: { label: "Go to home", action: "go_home" },
    secondary: { label: "Contact support", action: "contact_support" },
    variant: "warning",
  },
  update_required: {
    title: "Update required",
    description: "Please update the app to continue using NetQwix.",
    icon: "download-outline",
    primary: { label: "Update app", action: "open_store" },
  },
  email_not_verified: {
    title: "Verify your email",
    description: "Confirm your email address before using the app.",
    icon: "mail-outline",
    primary: { label: "Resend email", action: "resend_email" },
    secondary: { label: "Contact support", action: "contact_support" },
  },
  phone_verification_pending: {
    title: "Verify your phone number",
    description: "Enter the code we sent to finish setting up your account.",
    icon: "phone-portrait-outline",
    primary: { label: "Verify now", action: "verify_phone" },
  },
  account_suspended: {
    title: "Account suspended",
    description:
      "Your account has been temporarily restricted. Contact support for details.",
    icon: "warning-outline",
    primary: { label: "Contact support", action: "contact_support" },
    variant: "danger",
  },
  account_under_review: {
    title: "Your profile is under review",
    description:
      "We're reviewing your account. You'll be notified when it's approved.",
    icon: "hourglass-outline",
    primary: { label: "Go to home", action: "go_home" },
    supportLink: true,
  },
  password_reset_success: {
    title: "Password updated",
    description: "You can now sign in with your new password.",
    icon: "checkmark-circle-outline",
    primary: { label: "Login", action: "auth_login" },
    variant: "success",
  },
  password_reset_expired: {
    title: "Reset link expired",
    description: "Request a new password reset link to continue.",
    icon: "time-outline",
    primary: { label: "Request new link", action: "auth_login" },
  },
  too_many_login_attempts: {
    title: "Too many attempts",
    description: "Wait a few minutes before trying again, or reset your password.",
    icon: "shield-outline",
    primary: { label: "Try again later", action: "go_back" },
    secondary: { label: "Forgot password", action: "auth_login" },
    variant: "warning",
  },
  device_not_recognized: {
    title: "New device sign-in",
    description:
      "We noticed a sign-in from an unfamiliar device. If this wasn't you, change your password.",
    icon: "phone-portrait-outline",
    primary: { label: "Continue", action: "dismiss" },
    secondary: { label: "Contact support", action: "contact_support" },
  },
  trainer_not_assigned: {
    title: "No trainer assigned",
    description: "Book a lesson or ask support to match you with a coach.",
    icon: "person-outline",
    primary: { label: "Find a coach", action: "book_lesson" },
  },
  trainer_removed_you: {
    title: "Trainer relationship ended",
    description: "Your previous coach is no longer linked to your account.",
    icon: "person-remove-outline",
    primary: { label: "Find a new coach", action: "book_lesson" },
    supportLink: true,
  },
  profile_updated: {
    title: "Profile updated",
    description: "Your changes have been saved.",
    icon: "checkmark-circle-outline",
    primary: { label: "Continue", action: "dismiss" },
    variant: "success",
  },
  payment_success: {
    title: "Payment successful",
    description: "Thank you — your payment was processed.",
    icon: "checkmark-circle-outline",
    primary: { label: "Continue", action: "go_home" },
    variant: "success",
  },
  password_changed: {
    title: "Password changed",
    description: "Use your new password the next time you sign in.",
    icon: "checkmark-circle-outline",
    primary: { label: "OK", action: "dismiss" },
    variant: "success",
  },
  upload_failed: {
    title: "Upload failed",
    description: "We couldn't upload your file. Check your connection and try again.",
    icon: "cloud-upload-outline",
    primary: { label: "Try again", action: "retry" },
    variant: "danger",
  },
  upload_processing: {
    title: "Processing upload",
    description: "Your file is being processed. This may take a minute.",
    icon: "time-outline",
    primary: { label: "OK", action: "dismiss" },
  },
  slow_network: {
    title: "Slow connection detected",
    description: "Videos and calls may be delayed until your connection improves.",
    icon: "speedometer-outline",
    primary: { label: "OK", action: "dismiss" },
    variant: "warning",
  },
  api_failure: {
    title: "Couldn't sync data",
    description: "Your changes may not have saved. Please try again.",
    icon: "sync-outline",
    primary: { label: "Retry", action: "retry" },
    secondary: { label: "Contact support", action: "contact_support" },
  },
  trial_expired: {
    title: "Trial ended",
    description: "Subscribe to keep access to lessons and coaching tools.",
    icon: "timer-outline",
    primary: { label: "View plans", action: "open_wallet" },
  },
  no_active_plan: {
    title: "No active plan",
    description: "Choose a package to start booking lessons.",
    icon: "pricetag-outline",
    primary: { label: "View plans", action: "open_wallet" },
  },
  content_removed: {
    title: "Content unavailable",
    description: "This workout or game plan is no longer available.",
    icon: "document-outline",
    primary: { label: "Go back", action: "go_back" },
  },
  trainer_unavailable: {
    title: "Coach unavailable",
    description: "Your coach is offline or on vacation. Try again later or book another time.",
    icon: "calendar-outline",
    primary: { label: "View schedule", action: "book_lesson" },
  },
  geo_restricted: {
    title: "Not available in your region",
    description: "NetQwix isn't offered in your location yet.",
    icon: "globe-outline",
    primary: { label: "Contact support", action: "contact_support" },
  },
  feature_coming_soon: {
    title: "Coming soon",
    description: "We're working on this feature. Stay tuned!",
    icon: "rocket-outline",
    primary: { label: "Go back", action: "go_back" },
  },
  service_unavailable: {
    title: "Service temporarily unavailable",
    description: "Our servers are busy. Please try again in a few minutes.",
    icon: "server-outline",
    primary: { label: "Try again", action: "retry" },
    supportLink: true,
  },
  no_notifications: {
    title: "No notifications yet",
    description: "When something happens in your lessons or chats, you'll see it here.",
    icon: "notifications-off-outline",
    primary: { label: "Go to home", action: "go_home" },
  },
  storage_limit: {
    title: "Storage limit reached",
    description: "Delete older uploads or contact support to increase your limit.",
    icon: "folder-outline",
    primary: { label: "Manage clips", action: "open_clips" },
    secondary: { label: "Contact support", action: "contact_support" },
  },
  chat_support_offline: {
    title: "Support is offline",
    description: "Leave a message and we'll get back to you as soon as we can.",
    icon: "chatbubbles-outline",
    primary: { label: "Contact support", action: "contact_support" },
  },
  ai_recommendation_failed: {
    title: "Recommendation unavailable",
    description: "We couldn't generate a suggestion right now. Try again later.",
    icon: "sparkles-outline",
    primary: { label: "Try again", action: "retry" },
  },
};

export function getSystemStatePreset(id: SystemStateId): SystemStatePreset {
  return systemStateRegistry[id];
}
