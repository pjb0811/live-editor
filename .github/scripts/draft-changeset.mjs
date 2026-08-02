#!/usr/bin/env node
// Drafts a .changeset/pr-<number>.md file by asking Gemini to summarize
// this PR's diff to src/ as a semver bump + one-paragraph description, in
// changesets' own file format. Runs once per PR (the calling workflow skips
// this script entirely if a changeset file for this PR already exists), so
// it never overwrites something a human already wrote or edited.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_DIFF_CHARS = 12000;
const PACKAGE_NAME = '@jbpark/live-editor';
const PACKAGE_DIR = 'src';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function diffBetween(base, head) {
  return execFileSync(
    'git',
    ['diff', `${base}...${head}`, '--', PACKAGE_DIR],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 },
  );
}

async function main() {
  const apiKey = requireEnv('GEMINI_API_KEY');
  const baseSha = requireEnv('BASE_SHA');
  const headSha = requireEnv('HEAD_SHA');
  const prNumber = requireEnv('PR_NUMBER');

  let diff;
  try {
    diff = diffBetween(baseSha, headSha);
  } catch (err) {
    console.log(`Could not diff ${baseSha}...${headSha}: ${err.message}`);
    return;
  }

  if (!diff.trim()) {
    console.log(`No changes under ${PACKAGE_DIR} — skipping changeset draft.`);
    return;
  }

  const truncatedDiff =
    diff.length > MAX_DIFF_CHARS
      ? `${diff.slice(0, MAX_DIFF_CHARS)}\n... (truncated)`
      : diff;

  const systemPrompt = [
    'You are a release-notes assistant for an interactive UI editor',
    `(npm package "${PACKAGE_NAME}") that uses changesets for versioning.`,
    'It syncs canvas edits back to source code via AST transforms and',
    'includes a drag-and-drop panel, a CodeMirror-based code view, and a',
    'Tiptap rich-text editor for text bindings.',
    'You will be given a git diff for one pull request.',
    'bump: major = breaking API change (exported types/functions/props),',
    'minor = new backward-compatible feature or export, patch = bug fix,',
    'internal refactor, docs, or other non-breaking change.',
    'summary: one short paragraph (1-3 sentences), imperative present',
    'tense, describing the user-facing effect of this change — this text',
    'is used verbatim as a changelog entry, so do not include prose about',
    'the diff itself, file names, or meta-commentary.',
    'If the diff has no user-facing or API-relevant effect (pure test/',
    'internal-only noise), respond with bump "patch" and an empty summary.',
  ].join(' ');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: 'user',
          parts: [{ text: `\`\`\`diff\n${truncatedDiff}\n\`\`\`` }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            bump: { type: 'STRING', enum: ['major', 'minor', 'patch'] },
            summary: { type: 'STRING' },
          },
          required: ['bump', 'summary'],
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Gemini API request failed: ${response.status} ${response.statusText} — ${await response.text()}`,
    );
  }

  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const blockReason = body.promptFeedback?.blockReason;
    throw new Error(
      blockReason
        ? `Gemini blocked the request: ${blockReason}`
        : 'Gemini response missing candidates[0].content.parts[0].text',
    );
  }

  const result = JSON.parse(text);
  if (!['major', 'minor', 'patch'].includes(result.bump)) {
    throw new Error(`Invalid bump type "${result.bump}"`);
  }

  if (!result.summary || !result.summary.trim()) {
    console.log('Model reported no user-facing change — nothing to do.');
    return;
  }

  const filePath = `.changeset/pr-${prNumber}.md`;
  const fileContent = [
    '---',
    `'${PACKAGE_NAME}': ${result.bump}`,
    '---',
    '',
    result.summary.trim(),
    '',
  ].join('\n');

  fs.writeFileSync(filePath, fileContent);
  console.log(`Wrote ${filePath} (${result.bump}): ${result.summary}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
