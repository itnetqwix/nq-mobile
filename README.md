# nq-mobile

React Native (Expo) app for NetQwix.

## Open next to `nq-frontend` / `nq-backend` in Cursor

1. **Multi-root workspace (recommended):** in Cursor use **File → Open Workspace from File…** and choose  
   `/Users/kumarsatyam/Desktop/netqwix/netqwix.code-workspace`  
   That workspace includes `nq-frontend`, `nq-backend`, and `nq-mobile`.

2. **Add only this folder:** **File → Add Folder to Workspace…** → select  
   `/Users/kumarsatyam/Desktop/netqwix/nq-mobile`

## API / environment

REST calls use **`https://api-netqwix.com`** by default. Override locally with `.env`:

1. Copy the example file: `cp .env.example .env`
2. Edit `EXPO_PUBLIC_API_BASE_URL` if you need staging or another host.
3. Restart the dev server (`npm start` or `npm run expo`) so Metro picks up env changes.

Only variables prefixed with `EXPO_PUBLIC_` are available in app code (Expo inlines them at build time).

The Axios instance lives in [`src/api/client.ts`](src/api/client.ts); import `apiClient` from [`src/api`](src/api/index.ts).

Backend route references live in [`src/constants/routes.ts`](src/constants/routes.ts) (see `nq-backend-main` `authRoutes`, `masterRoutes`, `userRoutes`).

**Login payload (must match backend `loginModel`):** JSON body `{ "email": "…", "password": "…" }` to **`POST /auth/login`**. Success body is `ResponseBuilder` JSON; tokens are read from **`result.data.access_token`** and **`result.data.account_type`** (same as web `auth.slice.js`). Parsing helpers: [`parseLoginResponse.ts`](src/lib/http/parseLoginResponse.ts).

If sign-in shows a **network** error, confirm `.env` has the real API origin (no extra path like `/api` unless your gateway uses it) and restart Metro.

## Branding (same logo as web login)

- **Asset:** `assets/netquix_logo_v1.png` — same file as web `nq-frontend-main/public/assets/images/netquix_logo_v1.png` (login / sign-up).
- **Bundled use:** `src/constants/images.ts` + [`NetqwixLogo`](src/components/brand/NetqwixLogo.tsx) on Login, Sign up, Forgot password, and Home.
- **Native splash + session loader:** [`app.json`](app.json) `splash.image` uses the same file; while the app restores the session, [`BrandedSessionLoader`](src/components/brand/BrandedSessionLoader.tsx) shows the logo with a pulse + spinner.

## App flow (matches the website entry)

- **Cold start:** splash while the session is read from secure storage; if a token exists, **`GET /user/me`** restores the user (same idea as the web dashboard).
- **Signed out:** **Login** is the first screen → **Sign up** and **Forgot password** use the same REST paths as the Next app (`/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/user/me`, `/master/master-data`).
- **Signed in:** bottom tabs **Home** (welcome + role), **Bookings** (placeholder for upcoming sessions), **Profile** (sign out). Add trainer/trainee booking flows under `src/features/` as you port them.

## Folder structure (feature-based)

| Path | Role |
|------|------|
| `src/app/` | `AppRoot` — providers (gesture handler, safe area, React Query, auth, navigation). |
| `src/api/` | Axios `apiClient`, `API_BASE_URL`, request interceptor (Bearer from secure store). |
| `src/config/` | Env (`EXPO_PUBLIC_API_BASE_URL`). |
| `src/constants/` | Shared constants (`API_ROUTES`, storage key names aligned with web, account types). |
| `src/theme/` | Design tokens (colors, spacing). |
| `src/components/ui/` | Reusable primitives (`Screen`, `Button`, `TextField`). |
| `src/components/brand/` | NetQwix logo + branded session loader. |
| `src/navigation/` | `RootNavigator`, `AuthNavigator`, `MainTabs`, route types. |
| `src/features/auth/` | Auth API, secure session, `AuthContext`, login / signup / forgot screens. |
| `src/features/home/`, `bookings/`, `profile/` | One folder per product area; grow with `api/`, `hooks/`, `components/` inside each feature. |
| `src/lib/http/` | Small helpers (`getApiErrorMessage`). |

Server state uses **TanStack Query**; session and user summary use **`AuthContext`** so navigation stays simple until you add Redux if you want parity with the web store.

## Run

```bash
npm install
npm start
# same as: npm run expo   or   npx expo start
```

Then press `i` / `a` for iOS simulator or Android emulator.

### “No usable data found” on the phone (almost always iOS)

**Do not use the iPhone Camera app** (or Control Center QR scanner) on the QR from the terminal. Apple often shows **“No usable data found”** because `exp://` is not a normal web link and Camera will not hand off to Expo Go.

**Do this:**

1. Install **[Expo Go](https://expo.dev/go)** from the App Store.
2. Open the **Expo Go app** (orange icon) — stay inside that app.
3. Either:
   - **Scan with Expo’s scanner:** on the **Home** tab, use **Scan QR code** / camera icon **inside Expo Go** (not the system Camera), **or**
   - **Paste the URL:** use **Enter URL manually** (or the URL field / **+** on Home — label varies by Expo Go version).

**Paste URL (same Wi‑Fi as your Mac, no QR needed):**

```bash
npm run print:expo-url
```

Copy the printed `exp://…` line into Expo Go. If Metro uses a port other than **8081**, use the exact **“Metro waiting on exp://…”** line from the terminal where `npm start` is running.

**Different Wi‑Fi / VPN / tunnel:**

```bash
npm run start:tunnel
```

When Metro is up, **copy the full `exp://…` URL** from the terminal (select text) and paste it into Expo Go — still **not** the iPhone Camera.

**In the Metro terminal:** press `s` to switch LAN / Tunnel / Local if needed.

**Android:** the system camera often offers “Open with Expo Go”; iOS usually does not — use Expo Go’s scanner or paste URL only.
