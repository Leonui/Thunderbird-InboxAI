#!/usr/bin/env node

const fs = require('fs');

const [, , tag, changelogPath = 'CHANGELOG.md', outputPath = 'RELEASE_NOTES.md'] = process.argv;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!tag) {
  fail('Usage: node scripts/extract_release_notes.js <tag> [changelog] [output]');
}

const changelog = fs.readFileSync(changelogPath, 'utf8');
const lines = changelog.split(/\r?\n/);
const heading = `## ${tag}`;
const start = lines.findIndex((line) => line.trim() === heading);

if (start === -1) {
  fail(`No changelog section found for ${tag}.`);
}

const notes = [];
for (let index = start + 1; index < lines.length; index += 1) {
  const line = lines[index];
  if (/^##\s+/.test(line)) {
    break;
  }
  notes.push(line);
}

const body = notes.join('\n').trim();
if (!body) {
  fail(`Changelog section for ${tag} is empty.`);
}

fs.writeFileSync(outputPath, `${body}\n`);
console.log(`Wrote release notes for ${tag} to ${outputPath}`);
