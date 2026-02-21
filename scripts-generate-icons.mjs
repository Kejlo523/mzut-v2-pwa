import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = fileURLToPath(new URL('./assets/android-icon.png', import.meta.url));
const outputDir = fileURLToPath(new URL('./public/icons/', import.meta.url));

await mkdir(outputDir, { recursive: true });

await sharp(source)
  .resize(192, 192, { fit: 'cover' })
  .png({ quality: 90 })
  .toFile(`${outputDir}/icon-192.png`);

await sharp(source)
  .resize(512, 512, { fit: 'cover' })
  .png({ quality: 90 })
  .toFile(`${outputDir}/icon-512.png`);

await sharp(source)
  .resize(512, 512, { fit: 'cover' })
  .png({ quality: 90 })
  .toFile(`${outputDir}/icon-maskable-512.png`);

console.log('Generated PWA icons in public/icons');
