// Checks which built entries reach Babel. Compiling needs @babel/standalone
// and only the drag-and-drop editor and the AST helpers need Babel's AST
// packages, so a stray import that pulls either into a lighter entry costs
// its consumers megabytes they never use (#407). Walks each entry's static
// imports through `dist` and reads the bundled sources from the source maps.
// Run after `pnpm build`.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const AST_PACKAGES =
  /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@babel\/(parser|types|traverse|generator)\//;

// What each entry may reach. `true` means allowed.
const entries = {
  provider: { standalone: false, ast: false },
  editor: { standalone: false, ast: false },
  error: { standalone: false, ast: false },
  preview: { standalone: true, ast: false },
  'utils/tailwind': { standalone: false, ast: false },
};

const STATIC_IMPORT =
  /(?:^|\n)\s*(?:import|export)\b[^'"]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;

const reach = entry => {
  const chunks = new Set();
  const external = new Set();
  const visit = file => {
    if (chunks.has(file)) {
      return;
    }

    chunks.add(file);

    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const specifier = match[1] ?? match[2];

      if (specifier.startsWith('.')) {
        visit(resolve(dirname(file), specifier));
      } else {
        external.add(specifier);
      }
    }
  };

  visit(resolve(root, 'dist', entry, 'index.js'));

  const sources = [...chunks].flatMap(file =>
    existsSync(`${file}.map`)
      ? JSON.parse(readFileSync(`${file}.map`, 'utf8')).sources
      : [],
  );

  return {
    standalone: external.has('@babel/standalone'),
    ast: sources.some(source => AST_PACKAGES.test(source)),
  };
};

let failed = false;

for (const [entry, allowed] of Object.entries(entries)) {
  const found = reach(entry);
  const problems = Object.keys(found).filter(
    key => found[key] && !allowed[key],
  );

  if (problems.length > 0) {
    failed = true;
    console.error(`FAIL ${entry}: reaches ${problems.join(' and ')}`);
  } else {
    console.log(`ok   ${entry}`);
  }
}

// The check itself must still see Babel where it is expected, or a change in
// how chunks or source maps are written would make every entry pass.
const dnd = reach('dnd');

if (!dnd.standalone || !dnd.ast) {
  failed = true;
  console.error(
    'FAIL dnd: expected to reach @babel/standalone and the AST packages; the check cannot see them',
  );
}

if (failed) {
  process.exitCode = 1;
}
