#!/usr/bin/env node
// Changelog automation for .github/workflows/changelog-develop.yml.
// Asks a GitHub Models chat completion for a semver bump hint + Keep a
// Changelog (https://keepachangelog.com/en/1.1.0/) style bullets for the
// diff between two commits, then merges that into the "## [Unreleased]"
// section of CHANGELOG.md only. package.json is never touched here — the
// actual version bump happens later, on main, via promote-changelog.mjs.
// Exits non-zero on failure, which fails the workflow run (no changelog
// commit that time).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// GitHub Models' free tier caps request size per model (observed: gpt-4o
// rejects requests over 8000 tokens with a 413). gpt-4o-mini tends to get a
// more generous free-tier allowance, and this task doesn't need heavy
// reasoning, so default to it — but keep the diff budget conservative
// regardless, since a large merge can easily blow past either limit.
const MODEL = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o-mini';
const API_URL = 'https://models.github.ai/inference/chat/completions';
const MAX_DIFF_CHARS = 20000;
const CHANGELOG_PATH = 'CHANGELOG.md';
const PKG_PATH = 'package.json';

const CATEGORY_ORDER = [
  ['added', '추가'],
  ['changed', '변경'],
  ['deprecated', '사용 중단'],
  ['removed', '제거'],
  ['fixed', '수정'],
  ['security', '보안'],
];
const CATEGORY_KEYS = CATEGORY_ORDER.map(([key]) => key);
const SEVERITY = { patch: 0, minor: 1, major: 2 };
const BUMP_MARKER_RE = /<!-- next-bump: (major|minor|patch) -->/;

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

const DIFF_PATHSPEC = ['.', ':(exclude)CHANGELOG.md', ':(exclude)pnpm-lock.yaml', ':(exclude)dist'];

function gitDiffRaw(extraArgs) {
  try {
    return git(['diff', '--find-renames=30%', ...extraArgs, beforeSha, afterSha, '--', ...DIFF_PATHSPEC]);
  } catch {
    return '';
  }
}

// Returns { content, mode }. mode is 'full' (the real diff fit the
// budget), 'stat' (the full diff didn't fit, so a compact per-file
// diffstat summary is used instead — a hard character truncation would
// silently drop whichever files sort last, hiding most of a large merge
// from the model), or 'truncated' (even the stat summary didn't fit, so
// the raw diff is hard-cut as a last resort).
function diff() {
  const full = gitDiffRaw([]);
  if (full.length <= MAX_DIFF_CHARS) return { content: full, mode: 'full' };

  const stat = gitDiffRaw(['--stat']);
  if (stat && stat.length <= MAX_DIFF_CHARS) return { content: stat, mode: 'stat' };

  return { content: `${full.slice(0, MAX_DIFF_CHARS)}\n... (diff truncated)`, mode: 'truncated' };
}

function extractJson(content) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : content;
  return JSON.parse(raw.trim());
}

function validateResult(result) {
  if (!result || typeof result !== 'object') throw new Error('Model response is not an object');
  if (!Object.hasOwn(SEVERITY, result.bump)) throw new Error(`Invalid bump type "${result.bump}"`);
  if (!result.changes || typeof result.changes !== 'object') throw new Error('Missing changes object');
  for (const key of Object.keys(result.changes)) {
    if (!CATEGORY_KEYS.includes(key)) throw new Error(`Unknown changelog category "${key}"`);
    const items = result.changes[key];
    if (!Array.isArray(items) || items.some(item => typeof item !== 'string' || !item.trim())) {
      throw new Error(`Invalid entries for category "${key}"`);
    }
  }
  const hasAny = CATEGORY_KEYS.some(key => Array.isArray(result.changes[key]) && result.changes[key].length > 0);
  return hasAny ? result : null;
}

function ensureChangelogSkeleton(pkgName) {
  if (!fs.existsSync(CHANGELOG_PATH)) {
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
    fs.writeFileSync(CHANGELOG_PATH, header);
    return;
  }
  const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  if (/^## \[Unreleased\]/m.test(content)) return;
  const lines = content.split('\n');
  let insertAt = 1;
  while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++;
  lines.splice(insertAt, 0, '## [Unreleased]', '');
  fs.writeFileSync(CHANGELOG_PATH, lines.join('\n'));
}

function findUnreleasedBlock(lines) {
  const idx = lines.findIndex(l => l.trim() === '## [Unreleased]');
  if (idx === -1) throw new Error('CHANGELOG.md missing a "## [Unreleased]" heading');
  let end = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return { idx, end };
}

function parseCategories(blockLines) {
  const map = {};
  let current = null;
  for (const line of blockLines) {
    const cat = line.match(/^### (.+)$/);
    if (cat) {
      current = cat[1].trim();
      map[current] = map[current] || [];
      continue;
    }
    const bullet = line.match(/^- (.+)$/);
    if (bullet && current) map[current].push(bullet[1].trim());
  }
  return map;
}

function currentBump(blockLines) {
  const match = blockLines.join('\n').match(BUMP_MARKER_RE);
  return match ? match[1] : null;
}

function renderUnreleasedBody(bump, categories) {
  const out = [`<!-- next-bump: ${bump} -->`, ''];
  for (const [, label] of CATEGORY_ORDER) {
    const items = categories[label];
    if (!items || items.length === 0) continue;
    out.push(`### ${label}`, '');
    for (const item of items) out.push(`- ${item}`);
    out.push('');
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  out.push('');
  return out;
}

function applyChangelog(result) {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  ensureChangelogSkeleton(pkg.name);

  const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const lines = content.split('\n');
  const { idx, end } = findUnreleasedBlock(lines);
  const blockLines = lines.slice(idx + 1, end);

  const existingBump = currentBump(blockLines);
  const newBump = existingBump && SEVERITY[existingBump] > SEVERITY[result.bump] ? existingBump : result.bump;

  const categories = parseCategories(blockLines);
  for (const [key, label] of CATEGORY_ORDER) {
    const items = result.changes[key];
    if (!items || items.length === 0) continue;
    categories[label] = categories[label] || [];
    for (const item of items) {
      if (!categories[label].includes(item)) categories[label].push(item);
    }
  }

  const body = renderUnreleasedBody(newBump, categories);
  lines.splice(idx + 1, end - (idx + 1), ...body);
  fs.writeFileSync(CHANGELOG_PATH, lines.join('\n'));
}

async function main() {
  const { content: diffText, mode } = diff();
  if (!diffText.trim()) {
    console.log('No relevant changes in this push — nothing to do.');
    return;
  }
  if (mode !== 'full') {
    console.log(`Full diff exceeded ${MAX_DIFF_CHARS} chars — using ${mode === 'stat' ? 'a diffstat summary' : 'a truncated diff'} instead.`);
  }

  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));

  const systemPrompt = [
    'You are a release-notes assistant for a pnpm-managed single-package repo',
    'that follows the Keep a Changelog format (https://keepachangelog.com/en/1.1.0/).',
    'You will normally be given a git diff between two commits on the develop',
    'branch. When the real diff is too large to include, you will instead be',
    'given a compact per-file diffstat summary (path plus lines added/removed,',
    'no code) — in that case, infer categories and a bump from the file paths',
    'and change magnitude alone, group related paths into sensible bullets',
    '(e.g. by directory/feature/script name), and prefer a more conservative',
    '(lower) bump when the actual nature of a change is not clear from the',
    'path alone rather than assuming a breaking change.',
    'Respond with ONLY a JSON object, no prose, no markdown code fences,',
    "matching: { bump: 'major' | 'minor' | 'patch', changes: { added?:",
    'string[]; changed?: string[]; deprecated?: string[]; removed?: string[];',
    'fixed?: string[]; security?: string[]; } }',
    'Decide a semver `bump`: major = breaking API change, minor = new',
    'backward-compatible feature/prop/export, patch = bug fix, internal',
    'refactor, docs, or other non-breaking change.',
    '`changes` groups the update into Keep a Changelog categories — only',
    'include the categories that actually apply; each value is an array of',
    'short bullet strings (no leading "- ", that is added automatically).',
    'Write bullet text in Korean (한국어), regardless of what language the',
    'diff or older changelog entries happen to be in — this only affects',
    'the language of new text you write, not existing content.',
    'Keep each bullet concise and terse: do NOT end with polite full-sentence',
    'endings like "~했습니다" or "~합니다"; end with a short noun/verb-stem',
    'form instead (e.g. "~추가", "~수정", "~개선", "~제거"), matching this',
    "repository's commit-message convention style.",
    'Only include entries that have a real, user-facing/API-relevant, or',
    'meaningfully-affects-contributors change; omit anything that is purely',
    'internal/test/story-only noise with no one who would care to read about it.',
    'If there is truly nothing worth noting, respond with',
    '{"bump":"patch","changes":{}}.',
  ].join(' ');

  const diffDescription = mode === 'stat' ? 'per-file diffstat summary (full diff was too large to include)' : 'git diff';
  const userPrompt = `Package: ${pkg.name} (current version ${pkg.version})\n\nBelow is a ${diffDescription}:\n\n\`\`\`\n${diffText}\n\`\`\``;

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

  const result = validateResult(extractJson(content));
  if (!result) {
    console.log('Model reported no user-facing changes — nothing to do.');
    return;
  }

  applyChangelog(result);
  console.log(`Updated CHANGELOG.md [Unreleased] section (bump: ${result.bump})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
