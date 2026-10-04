import { describe, expect, it } from 'vitest';

// The deprecated names in the public `./utils` and `./utils/ast` barrels
// leave them in the next major (#522). Library code, tests and demos import
// them from their module files instead, so that removal touches only the
// barrels. This keeps a new import of one from creeping back in.
const sources = import.meta.glob<string>(
  ['/src/**/*.{ts,tsx}', '/demos/**/*.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
);

const barrels = {
  '~/utils': '/src/utils/index.ts',
  '~/utils/ast': '/src/utils/ast/index.ts',
};

const deprecatedNames = (file: string) =>
  [
    ...sources[file]!.matchAll(
      /\/\*\* @deprecated[^*]*\*\/\s*(?:export (?:const|type) )?(\w+)/g,
    ),
  ].map(match => match[1]!);

describe('public barrels', () => {
  it('deprecate something, so the pattern below still matches', () => {
    expect(deprecatedNames(barrels['~/utils/ast']).length).toBeGreaterThan(0);
    expect(deprecatedNames(barrels['~/utils']).length).toBeGreaterThan(0);
  });

  it('are not where the repo imports their deprecated names from', () => {
    const offenders: string[] = [];

    for (const [specifier, barrel] of Object.entries(barrels)) {
      const deprecated = new Set(deprecatedNames(barrel));
      const pattern = new RegExp(
        `import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+'${specifier}'`,
        'g',
      );

      for (const [file, source] of Object.entries(sources)) {
        for (const [, list] of source.matchAll(pattern)) {
          for (const part of list!.split(',')) {
            const name = part
              .trim()
              .replace(/^type\s+/, '')
              .split(/\s+as\s+/)[0];

            if (name && deprecated.has(name)) {
              offenders.push(`${file}: ${name}`);
            }
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
