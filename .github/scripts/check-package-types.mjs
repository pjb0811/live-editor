import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = join(root, 'tests/package-consumer');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'live-editor-types-'));

try {
  execFileSync('pnpm', ['pack', '--pack-destination', temporaryDirectory], {
    cwd: root,
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
    stdio: 'inherit',
  });

  const archive = readdirSync(temporaryDirectory).find(file =>
    file.endsWith('.tgz'),
  );

  if (!archive) {
    throw new Error('pnpm pack did not create a package archive');
  }

  execFileSync(
    'tar',
    ['-xzf', join(temporaryDirectory, archive), '-C', temporaryDirectory],
    { stdio: 'inherit' },
  );

  const consumer = join(temporaryDirectory, 'consumer');
  const packageScope = join(consumer, 'node_modules/@jbpark');

  cpSync(fixture, consumer, { recursive: true });
  mkdirSync(packageScope, { recursive: true });
  symlinkSync(
    join(temporaryDirectory, 'package'),
    join(packageScope, 'live-editor'),
  );
  symlinkSync(
    join(root, 'node_modules/@types'),
    join(consumer, 'node_modules/@types'),
  );

  execFileSync(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '-p', consumer],
    { stdio: 'inherit' },
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
