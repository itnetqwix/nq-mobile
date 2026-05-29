# Video call UX improvements (Phases A–C)

Mobile-native meeting UX polish. Socket/clip sync contracts are unchanged unless noted.

## Phase A — clarity & single loaders

- **Unified status banner** (`meetingUx.ts` → `resolveMeetingStatusBanner`) — one banner instead of stacked messages (camera, reconnect, connecting video, waiting).
- **Partner joined toast** (`MeetingPeerJoinedToast`) — non-blocking top chip; replaced fullscreen `PeerJoinedModal` in meetings.
- **Precall lobby** — simple network labels (Great / OK / Weak), honest “Background dim” copy, **Open Settings** when camera denied.
- **Reconnect overlay** — Wi‑Fi / cellular guidance.
- **Timer** — larger digits, syncing accessibility label.
- **Screenshots** — clearer success/failure messages; clip fallback explained.
- **Branded media loaders** — `MediaLoadingOverlay` (see `components/media/`).

## Phase B — clips, PIP, annotations, game plan

- **Clip picker** — PDF badge (“open after lesson”), cannot select PDFs for live playback, branded loading.
- **Trainee chip** — “Coach is controlling clips” during clip mode.
- **Drawing chip** — “Drawing on” for trainer when annotate mode is armed.
- **PIP snap** — video tiles magnetize to corners after drag (`DraggableVideoPip`).
- **Game plan modal** — step labels: Building PDF → Uploading → Saving; alert when PDF module missing.
- **Connection pill** — tap shows jitter in detail row.

## Phase C — honesty & backend

- **Background dim** badge (not “Blur ON”) until real frame blur ships.
- **Backend** (`reportService.createReport`) — push to trainee: “New session plan” when coach saves game plan (in addition to in-app notification).

## Modal stacking

- **Extension vs time warning** — only one at a time; opening extension dismisses 5/2‑min warning; timer thresholds skip the warning modal while extension UI is active.
- **Partner joined** — toast only (not a modal), so it does not stack with extension/time sheets.

## Not changed (avoid breaking)

- Clip socket event names and payloads.
- Trainer-only clip/annotation control rules.
- `MeetingClipToolbar` remains unused (tools live on `TimeRemaining` + `ActionButtons` to avoid duplicate chrome).
- iOS system PiP — still requires native module; no false promise in UI.

## QA smoke test

1. Lobby: network label, background dim toggle, takeover if two devices.
2. Join lesson: single status banner; partner joined toast (not modal).
3. Clips: picker shows PDF badge; trainee sees coach chip.
4. PIP: drag tile — snaps near corner; hide shows restore tab.
5. Screenshot: success message; game plan save steps.
6. Trainee receives push when coach saves game plan (device has push token).
