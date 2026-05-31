/**
 * Phase 1 of composited lesson video on mobile: periodic stage snapshots via view-shot.
 * Frames are collected locally during recording; native MP4 mux is Phase 2.
 */

export const LESSON_STAGE_FRAME_SAMPLER_ENABLED = true;

/** Interval between stage captures while recording is live. */
export const LESSON_STAGE_FRAME_INTERVAL_MS = 12_000;

export type LessonStageFrameSamplerHandle = {
  stop: () => Promise<string[]>;
};

export function startLessonStageFrameSampler(
  captureFrame: () => Promise<string | null>,
  intervalMs = LESSON_STAGE_FRAME_INTERVAL_MS
): LessonStageFrameSamplerHandle {
  const frames: string[] = [];
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const uri = await captureFrame();
    if (uri) frames.push(uri);
  };

  void tick();
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);

  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      return [...frames];
    },
  };
}
