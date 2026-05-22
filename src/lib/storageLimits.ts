/** Matches backend `MAX_CLIP_FILE_BYTES` (50 MB). */
export const MAX_CLIP_FILE_BYTES = 50 * 1024 * 1024;

export function formatStorageMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
