// Pure helpers for check-api-surface.mjs: read the names each package entry
// exports from the built `dist`, and compare them with the committed
// snapshot (#521).
//
// Names come from the files tsdown writes, not from the TypeScript compiler
// API, which TypeScript 7 no longer ships as a JavaScript module (#491).
// Each built entry ends in a single `export { ... }` statement. Values are
// the names the `.js` file exports. Types are what the `.d.ts` adds on top:
// a `type` modifier alone can't tell them apart, since an interface
// re-exported with a plain `export { Name }` carries none.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The exported names in a file's `export { ... }` statements: `A as B`
// exports `B`, and a leading `type` modifier is dropped.
export const parseExportNames = source => {
  const names = [];

  for (const [, list] of source.matchAll(/^export \{([^}]*)\};?$/gm)) {
    for (const part of list.split(',')) {
      const specifier = part.trim().replace(/^type\s+/, '');

      if (specifier) {
        names.push(specifier.split(/\s+as\s+/).pop());
      }
    }
  }

  return names;
};

// `{ exports, entries }`: every subpath in `package.json` `exports`, and for
// each one that has an `import`/`types` pair, its value and type exports.
// A subpath without one (`./style.css`) is listed but has no names.
export const readSurface = root => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const entries = {};

  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (typeof target !== 'object' || !target.import || !target.types) {
      continue;
    }

    const read = file => readFileSync(join(root, file), 'utf8');
    const values = new Set(parseExportNames(read(target.import)));
    const declared = parseExportNames(read(target.types));

    entries[subpath] = {
      values: [...values].sort(),
      types: declared.filter(name => !values.has(name)).sort(),
    };
  }

  return { exports: Object.keys(pkg.exports).sort(), entries };
};

const difference = (a = [], b = []) => a.filter(name => !b.includes(name));

// One line per change, e.g. `+ ./dnd value useDndHistory`. Empty when the
// two surfaces match.
export const diffSurface = (expected, actual) => {
  const lines = [];

  for (const subpath of difference(actual.exports, expected.exports)) {
    lines.push(`+ export ${subpath}`);
  }

  for (const subpath of difference(expected.exports, actual.exports)) {
    lines.push(`- export ${subpath}`);
  }

  const subpaths = new Set([
    ...Object.keys(expected.entries),
    ...Object.keys(actual.entries),
  ]);

  for (const subpath of [...subpaths].sort()) {
    const before = expected.entries[subpath] ?? {};
    const after = actual.entries[subpath] ?? {};

    for (const kind of ['values', 'types']) {
      const label = kind === 'values' ? 'value' : 'type';

      for (const name of difference(after[kind], before[kind])) {
        lines.push(`+ ${subpath} ${label} ${name}`);
      }

      for (const name of difference(before[kind], after[kind])) {
        lines.push(`- ${subpath} ${label} ${name}`);
      }
    }
  }

  return lines;
};
