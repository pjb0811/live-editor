// Changesets writes every entry of a version section as
// `- <short commit hash>: <summary>`. The hash is the one thing a rewritten
// entry can be matched back by, so it is what proves nothing was dropped.
const ENTRY = /^- ([0-9a-f]{7,40}):/gm;

export const entryHashes = raw =>
  [...raw.matchAll(ENTRY)].map(match => match[1]);

const countOf = (text, hash) => text.split(hash).length - 1;

// The entries of `raw` that `polished` does not cite, one hash per missing
// entry. One squash commit can carry several changesets, which then share a
// hash (4.1.0 had two from `abe85ff`), so a hash has to be cited once for
// each entry that carries it: seeing it once doesn't prove both survived.
export const findMissingEntries = (raw, polished) => {
  const expected = new Map();

  for (const hash of entryHashes(raw)) {
    expected.set(hash, (expected.get(hash) ?? 0) + 1);
  }

  return [...expected].flatMap(([hash, count]) =>
    Array(Math.max(0, count - countOf(polished, hash))).fill(hash),
  );
};

// The contents of the inline code spans in `text`, as CommonMark reads them:
// a run of backticks opens a span that only a run of the same length closes,
// so ``a`b`` is one span holding a`b. One space on each side is dropped when
// both are there, as in `` `x` ``.
export const codeSpans = text => {
  const spans = [];
  let index = 0;

  while (index < text.length) {
    const open = text.indexOf('`', index);

    if (open < 0) {
      break;
    }

    let length = 1;

    while (text[open + length] === '`') {
      length++;
    }

    const delimiter = '`'.repeat(length);
    let close = text.indexOf(delimiter, open + length);

    // A closing run must be exactly as long as the opening one.
    while (close >= 0 && text[close + length] === '`') {
      let end = close;

      while (text[end] === '`') {
        end++;
      }

      close = text.indexOf(delimiter, end);
    }

    if (close < 0) {
      index = open + length;
      continue;
    }

    const content = text.slice(open + length, close);

    spans.push(/^ .*[^ ].* $/s.test(content) ? content.slice(1, -1) : content);
    index = close + length;
  }

  return spans;
};

// Code that `polished` changed from `raw`. A rewrite may leave code out, or
// set a name from the text as code, but must not:
// - write code whose text isn't in `raw` (a reworded or invented name, or a
//   character swapped for a look-alike), or
// - cut a span that holds backticks short, as single backticks around
//   ``data-id={`a-${i}`}`` do: its text is there, but no longer one span.
export const findChangedCodeSpans = (raw, polished) => {
  const hashes = new Set(entryHashes(raw));
  const spans = codeSpans(polished);
  const unknown = spans.filter(
    span => !hashes.has(span) && !raw.includes(span),
  );
  const broken = codeSpans(raw).filter(
    span =>
      span.includes('`') && polished.includes(span) && !spans.includes(span),
  );

  return [...new Set([...unknown, ...broken])];
};
