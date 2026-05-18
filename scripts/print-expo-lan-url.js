#!/usr/bin/env node
/**
 * Prints connection URLs for Expo Go or the NetQwix development client.
 * iPhone Camera cannot open exp:// — never scan the terminal QR with Camera.
 */
const os = require("os");

const port = process.env.EXPO_METRO_PORT || "8081";

function firstLanIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const isIPv4 = net.family === "IPv4" || net.family === 4;
      if (isIPv4 && !net.internal) return net.address;
    }
  }
  return null;
}

const ip = firstLanIPv4();
if (!ip) {
  console.log(
    "Could not detect a LAN IP. After `npm start`, copy the full URL from the Metro terminal."
  );
  process.exit(0);
}

const expUrl = `exp://${ip}:${port}`;
const schemeUrl = `netqwix://expo-development-client/?url=${encodeURIComponent(expUrl)}`;

console.log(`
=== NetQwix development build (native video lessons) ===

A QR code does NOT install the app. You need the NetQwix dev app on your phone first.

Recommended (Mac + iPhone, no QR):
  npx expo run:ios --device
  (installs NetQwix, starts Metro, opens the app — use a USB cable if Wi‑Fi fails)

If the NetQwix dev app is already installed, start Metro for dev client:
  npm start
  (runs: expo start --dev-client)

Then on the phone:
  1. Open the NetQwix app (your icon) — NOT Expo Go, NOT iPhone Camera.
  2. On the development launcher screen, tap "Fetch development servers"
     or scan QR using the scanner INSIDE that app only.
  3. Or paste this URL in the dev client's manual entry field:

     ${expUrl}

  Deep link (some builds): ${schemeUrl}

=== Expo Go only (no native video lessons) ===

  npm run start:go
  Open Expo Go app → Enter URL manually → ${expUrl}
  (Do not use iPhone Camera — "No usable data found" is expected.)

=== Same Wi‑Fi / VPN issues ===

  npm run start:tunnel
  Then copy the "Metro waiting on …" line from the terminal into the dev client.

`);