// Changesets writes every entry of a version section as
// `- <short commit hash>: <summary>`. The hash is the one thing a rewritten
// entry can be matched back by, so it is what proves nothing was dropped.
const ENTRY = /^- ([0-9a-f]{7,40}):/gm;

export const entryHashes = raw =>
  [...raw.matchAll(ENTRY)].map(match => match[1]);

// The entries of `raw` whose hash does not appear anywhere in `polished`.
export const findMissingEntries = (raw, polished) =>
  entryHashes(raw).filter(hash => !polished.includes(hash));
