// Imports every non-UI package entry in plain Node, the way an SSR renderer
// or a build script would. These entries must not reach a UI kit: evaluating
// @jbpark/ui-kit's namespace reaches its stylesheet imports, which Node
// cannot load, so one stray import makes the whole entry unusable outside a
// bundler (#372). Run after `pnpm build`.
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const entries = ['utils', 'utils/ast', 'utils/tailwind', 'provider', 'error'];
const failures = [];

for (const entry of entries) {
  const file = pathToFileURL(resolve(root, 'dist', entry, 'index.js')).href;

  try {
    await import(file);
    console.log(`ok   ${entry}`);
  } catch (error) {
    failures.push(entry);
    console.error(`FAIL ${entry}: ${error.message}`);
  }
}

if (failures.length > 0) {
  process.exitCode = 1;
}
