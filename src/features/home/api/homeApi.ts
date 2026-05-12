import { apiClient } from "../../../api/client";
import { API_ROUTES } from "../../../config/apiRoutes";

/**
 * `/user/all-online-user` returns `ResponseBuilder` JSON; `data` may be an aggregate row
 * `{ trainer_info: { _id, fullName, … } }` per `userService.getAllLatestOnlineUser`.
 * Normalize to flat trainer objects for UI (matches web `onlineUsers` usage).
 */
function normalizeOnlineTrainerRows(raw: unknown): any[] {
  const rows = Array.isArray(raw) ? raw : [];
  const out: any[] = [];
  for (const row of rows) {
    const t = (row as any)?.trainer_info ?? row;
    const id = t?._id ?? (row as any)?.trainer_id;
    if (!id) continue;
    out.push({
      _id: String(id),
      id: String(id),
      fullname: t.fullname ?? t.fullName,
      fullName: t.fullName ?? t.fullname,
      profile_picture: t.profile_picture,
      category: t.category,
      account_type: "Trainer",
    });
  }
  return out;
}

export async function fetchOnlineUsers(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.allOnlineUser);
  const body = res.data as Record<string, unknown>;
  const raw =
    body?.result ??
    body?.data ??
    (Array.isArray(body) ? body : null);
  if (Array.isArray(raw)) return normalizeOnlineTrainerRows(raw);
  if (raw && typeof raw === "object" && Array.isArray((raw as any).data)) {
    return normalizeOnlineTrainerRows((raw as any).data);
  }
  return [];
}

/** Backend returns `{ data: Session[], page, limit, hasMore, ... }` for scheduled-meetings. */
export async function fetchScheduledMeetings(status = "upcoming"): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.scheduledMeetings, {
    params: { status },
  });
  const body = res.data?.result ?? res.data;
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
}

export async function fetchFriendRequests(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.friendRequests);
  return res.data?.friendRequests ?? res.data ?? [];
}

export async function fetchRecentTrainees(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.trainer.getRecentTrainees);
  return res.data?.result ?? res.data ?? [];
}

export async function fetchRecentTrainers(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.trainee.recentTrainers);
  return res.data?.result ?? res.data ?? [];
}

export async function postAcceptFriendRequest(requestId: string): Promise<any> {
  const res = await apiClient.post(API_ROUTES.user.acceptFriendRequest, { requestId });
  return res.data;
}

export async function postRejectFriendRequest(requestId: string): Promise<any> {
  const res = await apiClient.post(API_ROUTES.user.rejectFriendRequest, { requestId });
  return res.data;
}

export async function fetchNotifications(page = 1, limit = 20): Promise<any[]> {
  const res = await apiClient.get(`${API_ROUTES.notifications.list}?page=${page}&limit=${limit}`);
  return res.data?.result ?? res.data?.notifications ?? res.data ?? [];
}

export async function fetchTrainersWithSlots(params?: { search?: string }): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.trainee.getTrainersWithSlots, { params });
  return res.data?.result ?? res.data ?? [];
}

export async function fetchTrainerSlots(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.trainer.getSlots);
  return res.data?.result ?? res.data ?? [];
}

export async function fetchFriends(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.friends);
  return res.data?.friends ?? res.data ?? [];
}

export async function fetchAllUsers(): Promise<any[]> {
  const res = await apiClient.get(API_ROUTES.user.getAllUsers);
  return res.data?.result ?? res.data ?? [];
}
