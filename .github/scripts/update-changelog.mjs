#!/usr/bin/env node
// Changelog automation for .github/workflows/changelog-develop.yml.
// Asks a GitHub Models chat completion for a semver bump + Keep a Changelog
// (https://keepachangelog.com/en/1.1.0/) style entry for this (single)
// package's diff since the last run, then applies that JSON directly to
// package.json / CHANGELOG.md.
// Exits non-zero on failure, which fails the workflow run (no changelog PR
// that time).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// GitHub Models' free tier caps request size per model (observed: gpt-4o
// rejects requests over 8000 tokens with a 413). gpt-4o-mini tends to get a
// more generous free-tier allowance, and this task doesn't need heavy
// reasoning, so default to it — but keep the diff budget conservative
// regardless, since a large merge can easily blow past either limit.
const MODEL = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o-mini';
const API_URL = 'https://models.github.ai/inference/chat/completions';
const MAX_DIFF_CHARS = 20000;
const MAX_STYLE_EXAMPLE_CHARS = 600;

const CATEGORY_ORDER = [
  ['added', '추가'],
  ['changed', '변경'],
  ['deprecated', '사용 중단'],
  ['removed', '제거'],
  ['fixed', '수정'],
  ['security', '보안'],
];
const CATEGORY_KEYS = CATEGORY_ORDER.map(([key]) => key);

const ROOT_ID = '.';

const token = requireEnv('GITHUB_TOKEN');
const afterSha = requireEnv('AFTER_SHA');
const beforeSha = resolveBeforeSha(process.env.BEFORE_SHA, afterSha);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function resolveBeforeSha(before, after) {
  if (before && !/^0+$/.test(before)) return before;
  return git(['rev-parse', `${after}~1`]).trim();
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
}

function getPackage() {
  const pkgJsonPath = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  return {
    dir: ROOT_ID,
    pkgJsonPath,
    pkgName: pkg.name,
    version: pkg.version,
  };
}

function diffFor(pkg) {
  const pathspec = [ROOT_ID, ':(exclude)CHANGELOG.md', ':(exclude)pnpm-lock.yaml'];

  let diff;
  try {
    diff = git(['diff', beforeSha, afterSha, '--', ...pathspec]);
  } catch {
    return '';
  }
  if (diff.length > MAX_DIFF_CHARS) {
    diff = `${diff.slice(0, MAX_DIFF_CHARS)}\n... (diff truncated)`;
  }
  return diff;
}

function bumpVersion(version, bump) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function applyVersionBump(pkg, newVersion) {
  const text = fs.readFileSync(pkg.pkgJsonPath, 'utf8');
  const updated = text.replace(/"version":\s*"[^"]+"/, `"version": "${newVersion}"`);
  fs.writeFileSync(pkg.pkgJsonPath, updated);
}

function formatSection(newVersion, changes) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`## [${newVersion}] - ${today}`, ''];
  for (const [key, label] of CATEGORY_ORDER) {
    const items = changes[key];
    if (!items || items.length === 0) continue;
    lines.push(`### ${label}`, '');
    for (const item of items) lines.push(`- ${item.trim()}`);
    lines.push('');
  }
  return lines;
}

function ensureChangelogSkeleton(changelogPath, pkgName) {
  if (fs.existsSync(changelogPath)) return;
  const header = [
    `# ${pkgName}`,
    '',
    '이 프로젝트의 모든 주요 변경사항을 이 파일에 기록합니다.',
    '',
    '형식은 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)를 따르며,',
    '이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.',
    '',
    '## [Unreleased]',
    '',
  ].join('\n');
  fs.writeFileSync(changelogPath, header);
}

function applyChangelogEntry(pkg, newVersion, changes) {
  const changelogPath = 'CHANGELOG.md';
  ensureChangelogSkeleton(changelogPath, pkg.pkgName);

  const content = fs.readFileSync(changelogPath, 'utf8');
  const lines = content.split('\n');
  const unreleasedIdx = lines.findIndex(l => l.trim() === '## [Unreleased]');

  let insertAt;
  if (unreleasedIdx !== -1) {
    insertAt = unreleasedIdx + 1;
    while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
  } else {
    insertAt = lines.findIndex(l => l.startsWith('## '));
    if (insertAt === -1) insertAt = lines.length;
  }

  lines.splice(insertAt, 0, ...formatSection(newVersion, changes));
  fs.writeFileSync(changelogPath, lines.join('\n'));
}

function extractJson(content) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : content;
  return JSON.parse(raw.trim());
}

function validateResult(result, pkg) {
  if (!result || typeof result !== 'object') throw new Error('Result entry is not an object');
  if (!['major', 'minor', 'patch'].includes(result.bump)) {
    throw new Error(`Invalid bump type "${result.bump}"`);
  }
  if (!result.changes || typeof result.changes !== 'object') throw new Error('Missing changes object');
  const hasAny = CATEGORY_KEYS.some(key => Array.isArray(result.changes[key]) && result.changes[key].length > 0);
  if (!hasAny) throw new Error('No changelog categories populated');
  for (const key of Object.keys(result.changes)) {
    if (!CATEGORY_KEYS.includes(key)) throw new Error(`Unknown changelog category "${key}"`);
    const items = result.changes[key];
    if (!Array.isArray(items) || items.some(item => typeof item !== 'string' || !item.trim())) {
      throw new Error(`Invalid entries for category "${key}"`);
    }
  }
  return result;
}

async function main() {
  const pkg = getPackage();
  const diff = diffFor(pkg);

  if (diff.trim().length === 0) {
    console.log('No relevant changes — nothing to do.');
    return;
  }

  const truncate = (text, max) => (text.length > max ? `${text.slice(0, max)}\n... (truncated)` : text);

  const changelogPath = 'CHANGELOG.md';
  const styleExample = fs.existsSync(changelogPath)
    ? truncate(fs.readFileSync(changelogPath, 'utf8').split('\n').slice(0, 10).join('\n'), MAX_STYLE_EXAMPLE_CHARS)
    : '(파일 없음 — Keep a Changelog 형식 사용: "## [Unreleased]" 아래에 ' +
      '"## [x.y.z] - YYYY-MM-DD" 헤딩과 "### 추가/변경/사용 중단/제거/수정/보안" 하위 섹션)';

  const userPrompt = `## Package: ${pkg.pkgName} (current version: ${pkg.version})\n\n\`\`\`diff\n${truncate(diff, MAX_DIFF_CHARS)}\n\`\`\`\n\nCHANGELOG.md style example:\n\`\`\`\n${styleExample}\n\`\`\``;

  const systemPrompt = [
    'You are a release-notes assistant for a pnpm-managed single-package repo',
    'that follows the Keep a Changelog format (https://keepachangelog.com/en/1.1.0/).',
    'You will be given a git diff for the package.',
    'Respond with ONLY a JSON object, no prose, no markdown code fences, matching:',
    "{ bump: 'major' | 'minor' | 'patch'; changes: {",
    'added?: string[]; changed?: string[]; deprecated?: string[];',
    'removed?: string[]; fixed?: string[]; security?: string[]; } }',
    'Decide a semver `bump`: major = breaking API change, minor = new',
    'backward-compatible feature/prop/export, patch = bug fix, internal',
    'refactor, docs, or other non-breaking change.',
    '`changes` groups the update into Keep a Changelog categories — only',
    'include the categories that actually apply; each value is an array of',
    'short bullet strings (no leading "- ", that is added automatically).',
    'Write bullet text in Korean (한국어), regardless of what language the',
    'style example or older changelog entries happen to be in — this only',
    'affects the language of new text you write, not existing content.',
    'Keep each bullet concise and terse: do NOT end with polite full-sentence',
    'endings like "~했습니다" or "~합니다"; end with a short noun/verb-stem',
    'form instead (e.g. "~추가", "~수정", "~개선", "~제거"), matching this',
    "repository's commit-message convention style.",
    'Only include entries that have a real, user-facing/API-relevant, or',
    'meaningfully-affects-contributors change; omit anything that is purely',
    'internal/test/story-only noise with no one who would care to read about it.',
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
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub Models request failed: ${response.status} ${response.statusText} — ${await response.text()}`);
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('GitHub Models response missing choices[0].message.content');

  const result = validateResult(extractJson(content), pkg);

  const newVersion = bumpVersion(pkg.version, result.bump);
  applyVersionBump(pkg, newVersion);
  applyChangelogEntry(pkg, newVersion, result.changes);
  console.log(`Updated ${pkg.pkgName}: ${pkg.version} -> ${newVersion} (${result.bump})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
