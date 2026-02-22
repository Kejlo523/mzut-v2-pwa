import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = fileURLToPath(new URL('./assets/android-icon.png', import.meta.url));
const outputDir = fileURLToPath(new URL('./public/icons/', import.meta.url));

await mkdir(outputDir, { recursive: true });

// ── Regular icon (192px) ─────────────────────────────────────────────────
// Used on desktop, browser tabs, etc. Keep as-is (square with dark bg).
await sharp(source)
  .resize(192, 192, { fit: 'cover' })
  .png({ quality: 90 })
  .toFile(`${outputDir}/icon-192.png`);

// ── Regular icon (512px) ─────────────────────────────────────────────────
await sharp(source)
  .resize(512, 512, { fit: 'cover' })
  .png({ quality: 90 })
  .toFile(`${outputDir}/icon-512.png`);

// ── Maskable icon (512px) ────────────────────────────────────────────────
// For Android: logo must fit inside the inner 80% "safe zone".
// We place the source logo (which is ~60% of its own canvas) into a larger
// canvas so the logo ends up in the inner ~60% of the final 512px image.
// Background matches the app dark theme (#050505).
const MASKABLE_SIZE = 512;
const LOGO_SIZE = Math.round(MASKABLE_SIZE * 0.62); // ~318px logo area
const PAD = Math.round((MASKABLE_SIZE - LOGO_SIZE) / 2);

await sharp(source)
  .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'cover' })
  .extend({
    top: PAD,
    bottom: PAD,
    left: PAD,
    right: PAD,
    background: { r: 5, g: 5, b: 5, alpha: 1 }, // #050505
  })
  .resize(MASKABLE_SIZE, MASKABLE_SIZE) // ensure exact size
  .png({ quality: 90 })
  .toFile(`${outputDir}/icon-maskable-512.png`);

console.log('Generated PWA icons in public/icons');
