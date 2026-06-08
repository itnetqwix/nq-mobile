# Store credentials (never commit secrets)

Place local-only files here. Everything in this folder except this README is gitignored.

## iOS — TestFlight (App Store Connect API key — recommended)

1. [App Store Connect](https://appstoreconnect.apple.com/) → **Users and Access** → **Integrations** → **App Store Connect API** → create a key with **App Manager** role.
2. Download the `.p8` file once (you cannot download it again).
3. Save as `credentials/AuthKey_XXXXXXXXXX.p8`.
4. Note **Key ID** and **Issuer ID**.

Then add to `eas.json` under `submit.production.ios` (or pass flags on `eas submit`):

```json
"ascApiKeyPath": "./credentials/AuthKey_XXXXXXXXXX.p8",
"ascApiKeyId": "YOUR_KEY_ID",
"ascApiKeyIssuerId": "YOUR_ISSUER_UUID"
```

Alternatively, `eas submit` will prompt for your Apple ID + app-specific password on first use.

## Android — Google Play internal testing

1. [Google Play Console](https://play.google.com/console) → **Setup** → **API access** → link a Google Cloud project.
2. Create a **service account** with Play Console access → grant **Release to testing tracks** (or Admin for first setup).
3. Download JSON key → save as:

   `credentials/play-store-service-account.json`

`eas submit --platform android --profile production --latest` uploads to the **internal** track (see `eas.json`).
