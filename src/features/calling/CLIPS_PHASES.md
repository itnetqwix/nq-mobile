# Trainee mid-lesson clips — phased rollout

## Phase 0 — Contract (done)

- **Persist:** `PUT /user/add-trainee-clip/:id` with merged `trainee_clip` ids (same as booking flow).
- **Broadcast:** `ON_VIDEO_SELECT` `type: "clips"` (existing relay; no new socket event).
- **Playback:** Trainer controls play/pause/seek; trainee follows (`useClipSync` `isTrainer` gates).

## Phase 1 — Trainee send (done)

- `traineeMidLessonClips.ts` — merge ids + persist.
- `ClipPickerModal` `audience="trainee"` — locker + session tabs.
- `ActionButtons` — trainee clip library button.
- `NativeMeetingScreen` — `handleTraineeClipsPicked` → persist + `broadcastClipsMidLesson`.
- Session lookup invalidated after attach.

## Phase 2 — Trainer receive / sync (done)

- Trainer toast when peer `userInfo.from_user` is the trainee on `ON_VIDEO_SELECT`.
- Trainee banner: “Clips shared with coach” when they are in clip mode.
- `replayClipSocketState` unchanged (trainer reconnect only).

## QA

- [ ] Trainee picks 1–2 clips mid-call → coach sees clip stage + playback URLs.
- [ ] Re-open picker → session tab shows merged booking clips.
- [ ] Trainer can still override via clip picker.
- [ ] Retry persist (same ids) does not duplicate booking rows.
