#!/usr/bin/env node
/**
 * Regenerate 1024x1024 store icons from assets/netqwix_logo.png.
 * Run: node scripts/generate-app-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const assets = path.join(root, "assets");
const require = createRequire(import.meta.url);

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    const fallback = path.join(
      process.env.HOME ?? "",
      "Downloads/nq-backend-main/node_modules/sharp"
    );
    return require(fallback);
  }
}

const sharp = loadSharp();
const SIZE = 1024;
const BG = { r: 0, g: 0, b: 128 };
const PADDING = 0.16;
const maxDim = Math.round(SIZE * (1 - 2 * PADDING));

const logoPath = path.join(assets, "netqwix_logo.png");
const resized = await sharp(logoPath)
  .resize({ width: maxDim, height: maxDim, fit: "inside" })
  .png()
  .toBuffer();
const meta = await sharp(resized).metadata();
const left = Math.floor((SIZE - meta.width) / 2);
const top = Math.floor((SIZE - meta.height) / 2);

const out = await sharp({
  create: { width: SIZE, height: SIZE, channels: 3, background: BG },
})
  .composite([{ input: resized, left, top }])
  .flatten({ background: BG })
  .png()
  .toBuffer();

for (const name of ["app-icon.png", "adaptive-icon.png", "splash-icon.png"]) {
  fs.writeFileSync(path.join(assets, name), out);
  console.log(`wrote assets/${name}`);
}
