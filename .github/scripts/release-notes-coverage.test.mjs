import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { entryHashes, findMissingEntries } from './release-notes-coverage.mjs';

const raw = `### Major Changes

- 8d6c841: Draw the line between what the library owns
  and what a panel owns.

### Patch Changes

- d6aa94f: Stop autoHeight from dropping elements.
- a30b708: Stop autoHeight measurement from cancelling transitions.
`;

// The 4.0.0 section as released: long enough that the old 6,000-character
// cut silently dropped six of its seven patch entries.
const released = readFileSync(
  fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url)),
  'utf8',
).match(/^## 4\.0\.0\n[\s\S]*?(?=^## )/m)[0];

// 4.1.0: two of its three changesets came from the same squash commit.
const sharedHash = `### Minor Changes

- abe85ff: Update \`@jbpark/ui-kit\` to 10.

### Patch Changes

- abe85ff: Load the Tailwind compiler only when \`dynamicTailwind\` is on.
- 18ab6cc: Stop re-rendering every canvas section on every edit.
`;

describe('entryHashes', () => {
  it('reads the commit hash of every changeset entry', () => {
    expect(entryHashes(raw)).toEqual(['8d6c841', 'd6aa94f', 'a30b708']);
  });

  it('ignores continuation lines and nested bullets', () => {
    expect(
      entryHashes('- abc1234: one\n  - nested detail\n  more text'),
    ).toEqual(['abc1234']);
  });
});

describe('findMissingEntries', () => {
  it('passes notes that cite every entry', () => {
    const polished =
      '- Ownership is split (8d6c841)\n- Two autoHeight fixes (d6aa94f, a30b708)';

    expect(findMissingEntries(raw, polished)).toEqual([]);
  });

  it('names the entries a rewrite dropped', () => {
    expect(findMissingEntries(raw, '- Ownership is split (8d6c841)')).toEqual([
      'd6aa94f',
      'a30b708',
    ]);
  });

  it('catches the 4.0.0 truncation', () => {
    expect(entryHashes(released)).toHaveLength(12);
    expect(findMissingEntries(released, released.slice(0, 6000))).toHaveLength(
      6,
    );
  });

  describe('when entries share a commit hash', () => {
    it('counts one entry per changeset, not per hash', () => {
      expect(entryHashes(sharedHash)).toEqual([
        'abe85ff',
        'abe85ff',
        '18ab6cc',
      ]);
    });

    it('reports an entry the rewrite dropped though its hash still appears', () => {
      const polished =
        '- ui-kit 10 (abe85ff)\n- Sections re-render less (18ab6cc)';

      expect(findMissingEntries(sharedHash, polished)).toEqual(['abe85ff']);
    });

    it('passes notes that cite the hash once per entry', () => {
      const polished =
        '- ui-kit 10, and Tailwind loads lazily (abe85ff, abe85ff)\n- Sections re-render less (18ab6cc)';

      expect(findMissingEntries(sharedHash, polished)).toEqual([]);
    });

    it('reports every dropped entry when none of them is cited', () => {
      expect(
        findMissingEntries(sharedHash, '- Sections re-render less (18ab6cc)'),
      ).toEqual(['abe85ff', 'abe85ff']);
    });
  });
});
