#!/usr/bin/env node
// Rewrites a raw Keep-a-Changelog-style version section into flowing prose
// release notes via GitHub Models, for use as a GitHub Release body. Reads
// the raw changelog text from stdin, writes polished text to stdout.
// Exits non-zero on any failure — the caller falls back to the raw
// changelog text in that case, so a release is never blocked on this.

const MODEL = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o-mini';
const API_URL = 'https://models.github.ai/inference/chat/completions';
const MAX_CHARS = 6000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const token = requireEnv('GITHUB_TOKEN');
  const version = requireEnv('VERSION');
  const packageName = process.env.PACKAGE_NAME || '';
  const raw = (await readStdin()).trim();

  if (!raw) throw new Error('No changelog content on stdin');

  const truncated =
    raw.length > MAX_CHARS ? `${raw.slice(0, MAX_CHARS)}\n... (truncated)` : raw;

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
    'Respond with ONLY the Markdown release notes, no surrounding prose,',
    'no code fences.',
  ].join(' ');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: truncated },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub Models request failed: ${response.status} ${response.statusText} — ${await response.text()}`,
    );
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('GitHub Models response missing choices[0].message.content');
  }

  process.stdout.write(content);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
