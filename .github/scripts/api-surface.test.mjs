import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { diffSurface, parseExportNames, readSurface } from './api-surface.mjs';

describe('parseExportNames', () => {
  it('reads renamed, type-only and default exports', () => {
    expect(
      parseExportNames(
        'import { a as x } from "./chunk.js";\nexport { type Props, Dnd as default, cn, Guard as ErrorGuard };',
      ),
    ).toEqual(['Props', 'default', 'cn', 'ErrorGuard']);
  });

  it('ignores import lists', () => {
    expect(parseExportNames('import { a, b } from "./x.js";')).toEqual([]);
  });
});

describe('readSurface', () => {
  let root;

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('splits values from types, even an interface exported without `type`', () => {
    root = mkdtempSync(join(tmpdir(), 'api-surface-'));
    mkdirSync(join(root, 'dist'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        exports: {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' },
          './style.css': './dist/style.css',
        },
      }),
    );
    writeFileSync(
      join(root, 'dist/index.js'),
      'export { Live as default, cn };\n',
    );
    writeFileSync(
      join(root, 'dist/index.d.ts'),
      'export { Options, type Props, Live as default, cn };\n',
    );

    expect(readSurface(root)).toEqual({
      exports: ['.', './style.css'],
      entries: {
        '.': { values: ['cn', 'default'], types: ['Options', 'Props'] },
      },
    });
  });
});

describe('diffSurface', () => {
  const surface = (values, types, exports = ['.']) => ({
    exports,
    entries: { '.': { values, types } },
  });

  it('is empty when nothing changed', () => {
    expect(diffSurface(surface(['a'], ['T']), surface(['a'], ['T']))).toEqual(
      [],
    );
  });

  it('names added and removed exports and subpaths', () => {
    expect(
      diffSurface(
        surface(['a', 'b'], ['T']),
        surface(['a', 'c'], ['T', 'U'], ['.', './extra']),
      ),
    ).toEqual(['+ export ./extra', '+ . value c', '- . value b', '+ . type U']);
  });
});
