// Builds a distributable ZIP of the unpacked extension into dist/.
// Usage: npm run package

import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Only runtime files belong in the published package.
const FILES = ['manifest.json'];
const DIRECTORIES = ['src', 'icons', '_locales'];

async function main() {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  const distDir = join(root, 'dist');
  const zipName = `instagram-nao-segue-de-volta-v${manifest.version}.zip`;
  const zipPath = join(distDir, zipName);

  await mkdir(distDir, { recursive: true });
  await rm(zipPath, { force: true });

  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('warning', (err) => (err.code === 'ENOENT' ? console.warn(err) : reject(err)));
    archive.on('error', reject);
  });

  archive.pipe(output);
  for (const file of FILES) archive.file(join(root, file), { name: file });
  for (const dir of DIRECTORIES) archive.directory(join(root, dir), dir);
  await archive.finalize();

  await done;
  console.log(`✓ Packaged ${zipName} (${(archive.pointer() / 1024).toFixed(1)} KB) → dist/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
