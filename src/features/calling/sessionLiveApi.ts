import { apiClient } from "../../api/client";
import { API_ROUTES } from "../../config/apiRoutes";

export type JoinReadinessClip = {
  _id: string;
  title: string;
  thumbnail: string | null;
  category?: string | null;
  file_name?: string | null;
};

export type SessionJoinReadiness = {
  sessionId: string;
  status: string;
  is_instant: boolean;
  instant_phase: string | null;
  duration_minutes: number | null;
  booked_date?: string;
  session_start_time?: string;
  session_end_time?: string;
  time_zone?: string | null;
  join_deadline_at?: string | null;
  peer: {
    _id: string;
    fullname: string | null;
    profile_picture?: string | null;
    role: "trainer" | "trainee";
  } | null;
  clips: JoinReadinessClip[];
  clip_count: number;
  call_slot: {
    canJoin: boolean;
    canTakeOver?: boolean;
    reason?: string;
  };
  /** Server join gate (booking window + call slot). Prefer over client-only rules. */
  can_join?: boolean;
  join_block_reason?: string | null;
  join_code?: string | null;
  join_policy?: {
    can_join: boolean;
    block_reason: string | null;
    join_code: string | null;
  };
  extension_preview: {
    minutes: number;
    amount: number;
    allowed: boolean;
    reason?: string;
  } | null;
  timer: {
    remainingSeconds: number;
    status: string;
  } | null;
  lesson_client_requirement?: "native_app";
  mixed_client_warning?: string | null;
  peer_client_kind?: "native_app" | "web" | "unknown" | null;
  viewer_client_kind?: "native_app" | "web" | "unknown" | null;
  recommended_clients?: string[];
};

export async function fetchSessionJoinReadiness(
  sessionId: string
): Promise<SessionJoinReadiness | null> {
  const { data } = await apiClient.get(API_ROUTES.user.sessionJoinReadiness(sessionId));
  const inner =
    (data as { data?: SessionJoinReadiness })?.data ??
    (data as { result?: SessionJoinReadiness })?.result ??
    null;
  return inner;
}

export type SessionHandoffSummary = {
  sessionId: string;
  status: string;
  duration_minutes: number | null;
  total_extended_minutes: number;
  clips_reviewed_count: number;
  live_notes_count: number;
  shared_notes: Array<{ text: string; elapsed_seconds: number }>;
  can_rate: boolean;
  can_rebook: boolean;
  game_plan_status?: "none" | "pending" | "available";
  game_plan_title?: string | null;
  game_plan_expected_by?: string | null;
  game_plan_updated_at?: string | null;
  peer: {
    _id: string;
    fullname: string | null;
    role: "trainer" | "trainee";
  } | null;
  ended_at: string | null;
};

export async function fetchSessionHandoffSummary(
  sessionId: string
): Promise<SessionHandoffSummary | null> {
  const { data } = await apiClient.get(API_ROUTES.user.sessionHandoff(sessionId));
  const inner =
    (data as { data?: SessionHandoffSummary })?.data ??
    (data as { result?: SessionHandoffSummary })?.result ??
    null;
  return inner;
}

export type SessionTimeline = {
  sessionId: string;
  status: string;
  isInstant: boolean;
  instantPhase: string | null;
  bookedDate?: string;
  sessionStart?: string;
  sessionEnd?: string;
  startTimeUtc?: string | null;
  endTimeUtc?: string | null;
  bothJoinedAt?: string | null;
  acceptedAt?: string | null;
  joinDeadlineAt?: string | null;
  timer: {
    status: string;
    remainingSeconds: number;
    duration?: number;
  } | null;
  extensionRequests: Array<{
    requestId: string;
    status: string;
    minutes: number;
    amount: number;
    requestedAt?: string;
    expiresAt?: string;
    paymentIntentId?: string | null;
  }>;
  extensions: Array<{
    minutes: number;
    amount: number;
    appliedAt?: string;
    paymentIntentId?: string | null;
  }>;
  updatedAt?: string;
  createdAt?: string;
};

export async function fetchSessionTimeline(
  sessionId: string
): Promise<SessionTimeline | null> {
  const { data } = await apiClient.get(API_ROUTES.user.sessionTimeline(sessionId));
  const inner =
    (data as { data?: SessionTimeline })?.data ??
    (data as { result?: SessionTimeline })?.result ??
    null;
  return inner;
}
