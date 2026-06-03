import { getClipPlaybackUrl, isLikelyPdf } from "../../lib/clipMediaUrl";

export type ClipRecord = Record<string, any>;

export function clipIdOf(clip: ClipRecord | null | undefined): string | null {
  const id = clip?._id ?? clip?.id;
  if (id == null || id === "") return null;
  return String(id);
}

export function clipsFromSession(session: Record<string, any> | null | undefined): ClipRecord[] {
  if (!session) return [];
  const raw = session.trainee_clips ?? session.trainee_clip;
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is ClipRecord =>
        !!item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        Boolean(item._id ?? item.id)
    );
  }
  if (raw && typeof raw === "object") return [raw];
  return [];
}

export type JoinReadinessClipLike = {
  _id: string;
  title?: string;
  thumbnail?: string | null;
  category?: string | null;
  file_name?: string | null;
};

export function clipRowFromJoinReadiness(c: JoinReadinessClipLike): ClipRecord {
  return {
    _id: c._id,
    title: c.title,
    thumbnail: c.thumbnail,
    category: c.category,
    file_name: c.file_name ?? undefined,
  };
}

/** Merge booking `trainee_clips` with join-readiness rows (fills ids / file_name). */
export function mergeSessionClips(
  session: Record<string, any> | null | undefined,
  readinessClips?: JoinReadinessClipLike[] | null
): ClipRecord[] {
  const fromSession = clipsFromSession(session);
  const fromReadiness = (readinessClips ?? []).map(clipRowFromJoinReadiness);
  const byId = new Map<string, ClipRecord>();

  for (const clip of fromSession) {
    const id = clipIdOf(clip);
    if (id) byId.set(id, clip);
  }
  for (const clip of fromReadiness) {
    const id = clipIdOf(clip);
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, clip);
      continue;
    }
    byId.set(id, {
      ...existing,
      ...clip,
      title: existing.title ?? clip.title,
      thumbnail: existing.thumbnail ?? clip.thumbnail,
      category: existing.category ?? clip.category,
      file_name: existing.file_name ?? clip.file_name,
    });
  }
  return Array.from(byId.values());
}

export function hasPlayableClipUrl(clip: ClipRecord): boolean {
  return Boolean(resolveClipPlayback(clip).url || getClipPlaybackUrl(clip));
}

export function playableBookingClips(
  session: Record<string, any> | null | undefined,
  readinessClips?: JoinReadinessClipLike[] | null
): ClipRecord[] {
  return mergeSessionClips(session, readinessClips).filter(hasPlayableClipUrl);
}

/** True when booking rows only carry clip ids — need a fresh scheduled-meetings fetch. */
export function sessionNeedsClipHydration(session: Record<string, any> | null | undefined): boolean {
  if (!session) return false;
  const idOnly =
    Array.isArray(session.trainee_clip) &&
    session.trainee_clip.length > 0 &&
    (!Array.isArray(session.trainee_clips) || session.trainee_clips.length === 0);
  if (idOnly) return true;
  const clips = clipsFromSession(session);
  if (clips.length === 0) {
    const rawIds = session.trainee_clip;
    return Array.isArray(rawIds) && rawIds.length > 0;
  }
  return clips.every((c) => !resolveClipPlayback(c).url);
}

export function isPlayableVideoClip(clip: ClipRecord): boolean {
  const url = getClipPlaybackUrl(clip);
  if (!url) return false;
  const name = clip.file_name ?? clip.filename ?? clip.name ?? url;
  return !isLikelyPdf(String(name));
}

export function firstPlayableClip(clips: ClipRecord[]): ClipRecord | null {
  for (const c of clips) {
    if (isPlayableVideoClip(c)) return c;
  }
  return null;
}

export function resolveClipPlayback(clip: ClipRecord | null | undefined): {
  id: string | null;
  url: string | null;
} {
  if (!clip) return { id: null, url: null };
  const id = clipIdOf(clip);
  const url = getClipPlaybackUrl(clip) || null;
  return { id, url };
}

/** Normalize clips from socket so each item carries a resolvable playback URL. */
export function normalizeClipsFromSocket(videos: ClipRecord[]): ClipRecord[] {
  return videos.map((clip) => {
    const url = getClipPlaybackUrl(clip);
    if (!url) return clip;
    return {
      ...clip,
      playbackUrl: clip.playbackUrl ?? url,
      video_url: clip.video_url ?? url,
    };
  });
}

export function clipsFromSelectPayload(payload: any): ClipRecord[] {
  const videos = payload?.videos;
  if (Array.isArray(videos)) return videos.filter(Boolean);
  return [];
}

export function primaryClipFromList(clips: ClipRecord[]): ClipRecord | null {
  return firstPlayableClip(clips) ?? clips[0] ?? null;
}
