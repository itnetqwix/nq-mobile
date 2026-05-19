# System states (mobile)

Reusable full-screen and inline states for errors, empty data, and account gates.

## Usage

```tsx
import { navigateToSystemState, useSystemState } from "../system-states";

// Imperative navigation
navigateToSystemState("payment_failed", { message: optionalDetail });

// From context (inside provider)
const { showSystemState } = useSystemState();
showSystemState("upload_failed");

// Inline list empty
import { EmptyState } from "../../components/ui";
<EmptyState preset="no_results" />
```

## Registry

All presets live in `presets/systemStateRegistry.ts` (`offline`, `session_expired`, `empty_dashboard`, …).

## Global gates

- `SystemGateProvider` — offline + maintenance overlays
- `useSessionExpiredNavigation` — 401 → session expired screen
- `useUpdateRequiredGate` — `EXPO_PUBLIC_MIN_APP_VERSION`

## Dependencies

Offline detection uses `expo-network` (included with Expo SDK). After adding it, rebuild the dev client once: `npx expo run:ios` or `npx expo run:android`.
