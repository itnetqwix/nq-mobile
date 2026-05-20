# Instant lesson — native incoming call UI

Trainers receive instant lesson requests through **CallKit** (iOS) and **ConnectionService** (Android) via [`react-native-callkeep`](https://github.com/react-native-webrtc/react-native-callkeep).

## Requirements

- **Development build** — does not work in Expo Go.
- **Physical device** — CallKit / ConnectionService do not work on simulators.
- Rebuild native apps after changing `app.json` or native dependencies:

```bash
npx expo run:ios
# or
npx expo run:android
```

## Behaviour

| App state | Primary UI |
|-----------|----------------|
| Foreground | System call UI (CallKit banner / full screen, Android telecom incoming) |
| Background (process alive) | Same system call UI |
| Force-quit / JS not running | High-priority push notification (Accept / Decline). True lock-screen CallKit without opening the app needs **VoIP PushKit** (future phase). |

Accept on the system UI **confirms the booking only** — it does not auto-join the meeting. The trainer opens the app and joins within the join timer.

## Fallback

If CallKeep is unavailable (web, old build, setup failed), the app uses:

- In-app full-screen overlay when foreground
- Sticky local notification with Accept / Decline when background

## QA checklist

1. Rebuild dev client on a **real** phone.
2. Sign in as a **trainer**, stay online.
3. From another account, request an instant lesson while the trainer app is backgrounded.
4. Confirm system incoming call UI appears; Accept confirms session; Decline cancels.
5. With app in foreground, confirm system UI (not duplicate in-app overlay when CallKeep is ready).
