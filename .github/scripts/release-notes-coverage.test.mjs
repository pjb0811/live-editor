import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  codeSpans,
  entryHashes,
  findChangedCodeSpans,
  findMissingEntries,
} from './release-notes-coverage.mjs';

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

// 6.5.2 as released and as first polished: the rewrite wrapped a span that
// holds backticks in single backticks, which cut it into two spans.
const released652 = readFileSync(
  fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url)),
  'utf8',
).match(/^## 6\.5\.2\n[\s\S]*?(?=^## )/m)[0];

describe('codeSpans', () => {
  it('reads spans of any backtick length, and trims one space on each side', () => {
    expect(codeSpans('`a` and ``b`c`` and `` `d` `` and ```e``f```')).toEqual([
      'a',
      'b`c',
      '`d`',
      'e``f',
    ]);
  });

  it('closes a span only with a run of the same length', () => {
    expect(codeSpans('`a ``b`` c`')).toEqual(['a ``b`` c']);
  });

  it('skips a backtick run that nothing closes', () => {
    expect(codeSpans('a `` b `c`')).toEqual(['c']);
  });
});

describe('findChangedCodeSpans', () => {
  it('reports a span cut short by its own backticks', () => {
    const polished =
      '- an expression id like `data-id={`img-${index}`}` stays as written (57c1871)';

    expect(findChangedCodeSpans(released652, polished)).toEqual([
      'data-id={`img-${index}`}',
    ]);
  });

  it('passes notes that copy the spans, or leave some out', () => {
    const polished =
      '- An expression id such as ``data-id={`img-${index}`}`` stays as written in `Live.Dnd` (57c1871)';

    expect(findChangedCodeSpans(released652, polished)).toEqual([]);
  });

  it('reports code the rewrite invented or reworded', () => {
    expect(
      findChangedCodeSpans(released652, '- `Live.DnD` copies (57c1871)'),
    ).toEqual(['Live.DnD']);
  });

  it('passes a name from the text set as code', () => {
    expect(
      findChangedCodeSpans(
        released652,
        '- `Copying` a section renews ids (57c1871)',
      ),
    ).toEqual([]);
  });

  it('reports a character swapped for a look-alike', () => {
    expect(
      findChangedCodeSpans(
        released652,
        '- `data\u2011id` is renewed (57c1871)',
      ),
    ).toEqual(['data\u2011id']);
  });

  it('accepts an entry hash written as code', () => {
    expect(
      findChangedCodeSpans(released652, '- Copies renew ids (`57c1871`)'),
    ).toEqual([]);
  });
});
