#!/usr/bin/env node
// Rewrites a raw Keep-a-Changelog-style version section into flowing prose
// release notes, for use as a GitHub Release body. Reads the raw changelog
// text from stdin, writes polished text to stdout. Exits non-zero on any
// failure — the caller falls back to the raw changelog text in that case,
// so a release is never blocked on this.
//
// Uses NVIDIA's OpenAI-compatible API Catalog endpoint (not GitHub Models —
// retired as of 2026-07-30; see draft-changeset.mjs for the same move).

const MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';
const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MAX_CHARS = 6000;

// The API occasionally returns 503/429 for a few minutes at a time — retry
// those with backoff instead of failing outright. Non-retryable statuses
// (bad key, bad request, etc.) still fail on the first attempt.
const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 2000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, options);

    if (
      response.ok ||
      !RETRYABLE_STATUSES.has(response.status) ||
      attempt === MAX_ATTEMPTS
    ) {
      return response;
    }

    const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    console.log(
      `NVIDIA API returned ${response.status}, retrying in ${delayMs}ms (attempt ${attempt}/${MAX_ATTEMPTS})...`,
    );
    await sleep(delayMs);
  }
}

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
  const apiKey = requireEnv('NVIDIA_API_KEY');
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

  const response = await fetchWithRetry(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
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
      `NVIDIA API request failed: ${response.status} ${response.statusText} — ${await response.text()}`,
    );
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('NVIDIA API response missing choices[0].message.content');
  }

  process.stdout.write(content);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
