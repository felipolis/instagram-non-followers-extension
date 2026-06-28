// Rasterizes icons/icon.svg into the PNG sizes the extension uses.
// Usage: npm run icons

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'icons', 'icon.svg');
const SIZES = [16, 32, 48, 128];

async function main() {
  const svg = await readFile(source);

  for (const size of SIZES) {
    const out = join(root, 'icons', `icon${size}.png`);
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`✓ icon${size}.png`);
  }

  console.log(`\nGenerated ${SIZES.length} icons from icons/icon.svg`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
