#!/usr/bin/env node
/**
 * Prints an exp:// URL to paste into Expo Go ("Enter URL manually").
 * iPhone Camera cannot open exp:// — do not scan the QR with Camera.
 *
 * Default Metro port 8081 — if Metro chose another port, use the exact
 * "Metro waiting on exp://..." line from the terminal instead.
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
    "Could not detect a LAN IP. After `npm start`, copy the full `exp://...` line from the terminal into Expo Go."
  );
  process.exit(0);
}

console.log(`
--- Paste into Expo Go (not iPhone Camera) ---

  exp://${ip}:${port}

Steps:
  1. Install "Expo Go" from the App Store.
  2. Open the Expo Go app (orange icon).
  3. On the Home tab, use "Enter URL manually" or tap + / "Scan QR code"
     and use the IN-APP scanner only — never the iOS Camera app.
  4. Paste the URL above (same Wi‑Fi as this Mac).

If connection fails, run: npm run start:tunnel
Then copy the "Metro waiting on exp://..." URL from that terminal output.
`);
