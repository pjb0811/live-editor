#!/usr/bin/env node
// Rewrites a raw Keep-a-Changelog-style version section into flowing prose
// release notes, for use as a GitHub Release body. Reads the raw changelog
// text from stdin, writes polished text to stdout. Exits non-zero on any
// failure — the caller falls back to the raw changelog text in that case,
// so a release is never blocked on this.
//
// Uses NVIDIA's OpenAI-compatible API Catalog endpoint. Model selection and
// fallback logic live in nvidia-chat.mjs.
import { nvidiaChat, requireEnv } from './nvidia-chat.mjs';
import { findMissingEntries } from './release-notes-coverage.mjs';

// Over this, fail instead of sending a cut-down section: the caller then
// publishes the raw changelog, which is complete. Truncating here is what
// dropped six of 4.0.0's seven patch entries from its release notes.
const MAX_CHARS = 20000;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const apiKey = requireEnv('NVIDIA_API_KEY');
  const version = requireEnv('VERSION');
  const packageName = process.env.PACKAGE_NAME || '';
  const raw = (await readStdin()).trim();

  if (!raw) throw new Error('No changelog content on stdin');

  if (raw.length > MAX_CHARS) {
    throw new Error(
      `Changelog section is ${raw.length} characters, over the ${MAX_CHARS} this sends; use the raw changelog`,
    );
  }

  const systemPrompt = [
    'You write GitHub Release notes for an open-source npm package',
    `${packageName ? `(${packageName}) ` : ''}version ${version}.`,
    'You will be given its raw Keep a Changelog-style entry for this',
    'release (### Added/Changed/Fixed/etc. bullet sections).',
    'Rewrite it as short, flowing release notes in Markdown: a one-sentence',
    'summary of the release followed by concise bullet points grouped',
    'naturally (you may keep Added/Changed/Fixed-style headings, or drop',
    'them if the release is small). Keep every factual detail from the',
    'input — do not invent features or fixes that are not mentioned.',
    'Every input entry starts with a short commit hash (`- 8d6c841: ...`).',
    'Cover every entry, and end each bullet with the hash of each entry it',
    'covers in parentheses, e.g. (8d6c841) or (d6aa94f, a30b708).',
    'Respond with ONLY the Markdown release notes, no surrounding prose,',
    'no code fences.',
  ].join(' ');

  const content = await nvidiaChat(apiKey, {
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: raw },
    ],
  });

  // A rewrite that lost an entry (a cut-off response, or one the model
  // skipped) must not become the release body.
  const missing = findMissingEntries(raw, content);

  if (missing.length > 0) {
    throw new Error(
      `Polished notes dropped ${missing.length} entries: ${missing.join(', ')}`,
    );
  }

  process.stdout.write(content);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
