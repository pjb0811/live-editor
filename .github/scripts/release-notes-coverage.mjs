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
