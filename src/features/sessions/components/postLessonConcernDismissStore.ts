const dismissedSessionIds = new Set<string>();

export function isPostLessonConcernDismissed(sessionId: string): boolean {
  return dismissedSessionIds.has(sessionId);
}

export function dismissPostLessonConcern(sessionId: string): void {
  dismissedSessionIds.add(sessionId);
}
