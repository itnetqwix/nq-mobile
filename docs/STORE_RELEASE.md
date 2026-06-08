# NetQwix — TestFlight (iOS) & Google Play internal testing

Package IDs (do not change after first store upload):

| Platform | ID |
|----------|-----|
| iOS | `com.netqwix.nqmobile` |
| Android | `com.netqwix.mobile` |

---

## Part A — TestFlight (iOS)

### A1. Apple / App Store Connect (one-time)

1. [Apple Developer](https://developer.apple.com/account) — membership active.
2. [App Store Connect](https://appstoreconnect.apple.com/) → **Apps** → **+** → **New App**.
   - Platform: iOS  
   - Name: **NetQwix**  
   - Bundle ID: **com.netqwix.nqmobile** (register in Developer → Identifiers if missing)  
   - SKU: e.g. `netqwix-mobile-ios`
3. Copy **Apple ID** (numeric App Store Connect app id) from **App Information** → put in `eas.json` → `submit.production.ios.ascAppId`.
4. Copy **Team ID** from Developer account → `submit.production.ios.appleTeamId`.
5. **App Privacy** questionnaire in App Store Connect (data collected: account, email, video/audio, payments, etc.).
6. **TestFlight** tab — no extra setup before first build.

### A2. Build & upload (from repo)

```bash
cd /Users/kumarsatyam/Desktop/netqwix/nq-mobile
npm install -g eas-cli   # if needed
eas login                # Expo account: netqwix org
eas build --platform ios --profile production
```

When the build finishes:

```bash
eas submit --platform ios --profile production --latest
```

Or build + submit in one step:

```bash
npm run deploy:testflight
```

First submit: EAS asks for Apple credentials or uses API key in `credentials/` (see `credentials/README.md`).

### A3. Invite testers

1. App Store Connect → your app → **TestFlight**.
2. Wait for build status **Ready to Submit** / processing (~5–30 min).
3. **Internal testing** → add users with App Store Connect roles, or **External testing** → add emails + short beta review (first time).
4. Testers install **TestFlight** app → accept invite → install NetQwix.

---

## Part B — Google Play internal testing

### B1. Play Console (one-time)

1. [Play Console](https://play.google.com/console) → **Create app** → package **com.netqwix.mobile**.
2. Complete **Dashboard** tasks:
   - Privacy policy URL (e.g. `https://netqwix.com/privacy`)
   - App access (test login if required)
   - Ads: No
   - Content rating (IARC questionnaire)
   - Target audience
   - Data safety form
   - Store listing: icon 512×512, feature graphic 1024×500, ≥2 screenshots
3. **Setup → API access** → service account → download JSON →  
   `credentials/play-store-service-account.json`

### B2. Build & upload

```bash
eas build --platform android --profile production
eas submit --platform android --profile production --latest
```

Or:

```bash
npm run deploy:play-internal
```

Upload goes to **Internal testing** track (`eas.json` → `submit.production.android.track`).

### B3. Add testers

1. **Testing → Internal testing** → create email list.
2. Share **opt-in link** with testers (Gmail accounts).
3. They install from Play Store after accepting.

### B4. Google Sign-In on release builds

After first Android build:

```bash
eas credentials -p android
```

Copy **SHA-1** of the upload keystore → [Google Cloud Console](https://console.cloud.google.com/) → OAuth Android client for `com.netqwix.mobile` → add SHA-1.

---

## Quick command reference

| Goal | Command |
|------|---------|
| iOS TestFlight build | `npm run build:testflight` |
| Submit latest iOS to TestFlight | `npm run submit:testflight` |
| iOS build + submit | `npm run deploy:testflight` |
| Android Play AAB | `npm run build:play-internal` |
| Submit latest AAB to internal track | `npm run submit:play-internal` |
| Android build + submit | `npm run deploy:play-internal` |
| Checklist before building | `npm run store:preflight` |

---

## Versioning

`eas.json` uses `"appVersionSource": "remote"` and production `"autoIncrement": true`.

- User-visible version: `app.json` → `expo.version` (e.g. `1.0.0`)
- iOS build number / Android versionCode: incremented automatically on each production build

Bump `expo.version` in `app.json` when you ship a new marketing version (1.0.1, 1.1.0, …).
