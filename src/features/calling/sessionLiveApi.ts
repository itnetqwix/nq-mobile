import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

export type JoinReadinessClip = {
  _id: string;
  title: string;
  thumbnail: string | null;
  category?: string | null;
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
