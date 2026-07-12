#!/usr/bin/env node
// Release automation for .github/workflows/publish.yml, run on pushes to
// main. Purely mechanical (no AI call): reads the bump hint accumulated in
// CHANGELOG.md's "## [Unreleased]" section (written by
// update-changelog.mjs on develop), stamps that section with a real
// version + date, bumps package.json to match, and reopens an empty
// "## [Unreleased]" section for future entries.
//
// No-ops (exit 0, released=false) when there is nothing accumulated to
// promote — this happens on every ordinary main push that isn't a fresh
// develop -> main merge.

import fs from 'node:fs';

const CHANGELOG_PATH = 'CHANGELOG.md';
const PKG_PATH = 'package.json';
const BUMP_MARKER_RE = /<!-- next-bump: (major|minor|patch) -->/;

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) fs.appendFileSync(file, `${name}=${value}\n`);
  console.log(`${name}=${value}`);
}

function bumpVersion(version, bump) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function findUnreleasedBlock(lines) {
  const idx = lines.findIndex(l => l.trim() === '## [Unreleased]');
  if (idx === -1) return null;
  let end = lines.length;
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return { idx, end };
}

function main() {
  const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const lines = content.split('\n');
  const block = findUnreleasedBlock(lines);
  if (!block) {
    console.log('No "## [Unreleased]" section — nothing to release.');
    setOutput('released', 'false');
    return;
  }

  const { idx, end } = block;
  const blockLines = lines.slice(idx + 1, end);
  const bumpMatch = blockLines.join('\n').match(BUMP_MARKER_RE);
  const hasContent = blockLines.some(l => l.trim().startsWith('### '));

  if (!bumpMatch || !hasContent) {
    console.log('No accumulated Unreleased changes — nothing to release.');
    setOutput('released', 'false');
    return;
  }

  const bump = bumpMatch[1];
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const newVersion = bumpVersion(pkg.version, bump);
  const today = new Date().toISOString().slice(0, 10);

  const cleanedBlock = blockLines.filter(l => !BUMP_MARKER_RE.test(l));
  while (cleanedBlock.length && cleanedBlock[0].trim() === '') cleanedBlock.shift();
  while (cleanedBlock.length && cleanedBlock[cleanedBlock.length - 1].trim() === '') cleanedBlock.pop();

  const newLines = [
    ...lines.slice(0, idx),
    '## [Unreleased]',
    '',
    `## [${newVersion}] - ${today}`,
    '',
    ...cleanedBlock,
    '',
    ...lines.slice(end),
  ];
  fs.writeFileSync(CHANGELOG_PATH, newLines.join('\n'));

  const pkgText = fs.readFileSync(PKG_PATH, 'utf8');
  fs.writeFileSync(PKG_PATH, pkgText.replace(/"version":\s*"[^"]+"/, `"version": "${newVersion}"`));

  console.log(`Promoted Unreleased -> ${newVersion} (${bump})`);
  setOutput('released', 'true');
  setOutput('version', newVersion);
}

main();
