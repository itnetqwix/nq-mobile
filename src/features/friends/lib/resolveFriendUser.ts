export type ResolvedFriendUser = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function idFrom(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  const row = asRecord(value);
  return row ? String(row._id ?? row.id ?? row.user_id ?? "") : "";
}

function candidateFrom(value: unknown): Record<string, unknown> | null {
  const row = asRecord(value);
  if (row) return row;
  const id = idFrom(value);
  return id ? { _id: id } : null;
}

function nameFrom(candidate: Record<string, unknown>, fallback: Record<string, unknown>): string {
  return String(
    candidate.fullname ??
      candidate.fullName ??
      candidate.full_name ??
      candidate.name ??
      candidate.email ??
      fallback.fullname ??
      fallback.fullName ??
      fallback.full_name ??
      fallback.name ??
      fallback.email ??
      "Friend"
  );
}

/**
 * `/user/friends` returns friendship rows in many screens, where the top-level
 * `_id` is the friendship document. Sharing APIs need the other user's id.
 */
export function resolveFriendUser(
  friendRow: unknown,
  currentUserId?: string | null
): ResolvedFriendUser | null {
  const row = asRecord(friendRow);
  if (!row) return null;

  const normalizedCurrentUserId = currentUserId ? String(currentUserId) : "";
  const receiver = candidateFrom(row.receiverId);
  const sender = candidateFrom(row.senderId);
  const friendshipShape = row.receiverId != null || row.senderId != null;

  const candidates = [receiver, sender].filter(Boolean) as Record<string, unknown>[];
  let selected = candidates.find((candidate) => {
    const id = idFrom(candidate);
    return id && (!normalizedCurrentUserId || id !== normalizedCurrentUserId);
  });

  if (!selected && !friendshipShape) {
    selected = row;
  }

  if (!selected) return null;
  const id = idFrom(selected);
  if (!id || id === normalizedCurrentUserId) return null;

  return {
    id,
    name: nameFrom(selected, row),
    email: String(selected.email ?? row.email ?? ""),
    avatar: String(
      selected.profile_picture ??
        selected.avatar ??
        row.profile_picture ??
        row.avatar ??
        ""
    ),
  };
}
