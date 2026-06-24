# Release binaries

Android App Bundles (`.aab`) and APKs are built locally and uploaded to Google Play Console directly.

They are **not** stored in git (GitHub’s 100 MB file limit).

After `eas build` or a local Gradle release build, copy the artifact here for your own reference, e.g.:

- `NetQwix-1.0.0-vc8.aab`

See `docs/STORE_RELEASE.md` for the full release checklist.
