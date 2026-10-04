// Fails when the names the package exports differ from
// api-surface.snapshot.json, so every added, renamed or removed export,
// type-only ones included, shows up as a reviewed snapshot diff (#521). Run
// after `pnpm build`. `--update` rewrites the snapshot after an intended
// change.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

import { diffSurface, readSurface } from './api-surface.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const snapshotPath = resolve(here, 'api-surface.snapshot.json');
const surface = readSurface(root);

if (process.argv.includes('--update')) {
  // Formatted like the rest of the repo, so a `prettier --write` doesn't
  // turn an unchanged surface into a diff.
  const options = await prettier.resolveConfig(snapshotPath);
  const json = await prettier.format(JSON.stringify(surface, null, 2), {
    ...options,
    filepath: snapshotPath,
  });

  writeFileSync(snapshotPath, json);
  console.log(`Updated ${snapshotPath}`);
} else {
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const changes = diffSurface(snapshot, surface);

  if (changes.length > 0) {
    console.error('The exported API differs from api-surface.snapshot.json:');

    for (const line of changes) {
      console.error(`  ${line}`);
    }

    console.error(
      '\nIf the change is intended, run `pnpm check-api-surface --update` and commit the snapshot.',
    );
    process.exitCode = 1;
  } else {
    const count = Object.values(surface.entries).reduce(
      (total, entry) => total + entry.values.length + entry.types.length,
      0,
    );

    console.log(
      `API surface matches the snapshot: ${count} exports across ${surface.exports.length} subpaths.`,
    );
  }
}
