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
```

Default is **`expo start --dev-client`** (for the NetQwix development build with native video).

| Command | Use when |
|---------|----------|
| `npm start` | NetQwix **dev client** app is installed (native lessons) |
| `npm run start:go` | Testing in **Expo Go** only (no native video lessons) |
| `npm run ios` | Build + install + launch on simulator/device (best for native video) |

Press `i` / `a` in Metro for simulator after `npm run ios` once.

### Instant / video lessons (native only — not Expo Go)

Lessons use **fully native in-app video** (`NativeMeetingScreen` + `react-native-webrtc`), like Google Meet — **not** a web page in the app.

| How you run the app | Video lessons |
|---------------------|---------------|
| **Expo Go** (`npm run start:go` + QR) | Not supported |
| **Development build** (`npm run ios` / EAS dev IPA) | Full native UI |
| **Store build** (TestFlight / Play) | Full native UI |

### Install the development build (required once)

**Scanning the Metro QR code does not install the app.** It only tells an already-installed app where Metro is. iPhone **Camera** often shows **“No usable data found”** — that is normal; never use Camera for this QR.

**Best path (Mac + iPhone, no QR):**

```bash
npx expo prebuild   # first time only
npx expo run:ios --device
```

Use a USB cable if the phone does not find Metro over Wi‑Fi. This installs **NetQwix** with WebRTC and opens it connected to Metro.

**If you already installed a dev build (EAS or `run:ios`):**

```bash
npm start
```

On the phone:

1. Open the **NetQwix** app (your app icon) — **not** Expo Go.
2. On the expo-dev-client screen, use **Fetch development servers** or the **in-app** QR scanner (not iPhone Camera).
3. Or paste the URL from `npm run print:expo-url` into the dev client’s manual URL field.

**EAS development IPA:** install from the EAS build link / TestFlight first, then `npm start` and open NetQwix as above.

### “No usable data found” when scanning

| Scanner | Result |
|---------|--------|
| **iPhone Camera** on terminal QR | Usually **“No usable data found”** — wrong tool |
| **Expo Go** after `npm start` (dev-client mode) | Wrong app — use NetQwix dev build |
| **NetQwix app** dev launcher (in-app scan) | Correct |
| **`npx expo run:ios --device`** | No QR needed |

```bash
npm run print:expo-url
```

**Different Wi‑Fi / VPN:**

```bash
npm run start:tunnel
```

Copy the full URL from the Metro terminal into the **NetQwix** dev client, not Camera.
