#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const script = path.join(root, 'scripts', 'extract_release_notes.js');

function runExtractor(tag, changelog) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inboxai-release-notes-'));
  const changelogPath = path.join(tmpDir, 'CHANGELOG.md');
  const outputPath = path.join(tmpDir, 'RELEASE_NOTES.md');

  fs.writeFileSync(changelogPath, changelog);
  const result = spawnSync(process.execPath, [script, tag, changelogPath, outputPath], {
    encoding: 'utf8'
  });

  return {
    result,
    outputPath
  };
}

function testExtractsRequestedVersionOnly() {
  const { result, outputPath } = runExtractor('v1.2.0', [
    '# Changelog',
    '',
    '## Unreleased',
    '',
    '- Future change',
    '',
    '## v1.2.0',
    '',
    '### Added',
    '',
    '- Release change',
    '',
    '## v1.1.0',
    '',
    '- Older change',
    ''
  ].join('\n'));

  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(fs.readFileSync(outputPath, 'utf8'), '### Added\n\n- Release change\n');
}

function testFailsWhenVersionIsMissing() {
  const { result } = runExtractor('v9.9.9', [
    '# Changelog',
    '',
    '## v1.2.0',
    '',
    '- Release change',
    ''
  ].join('\n'));

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /No changelog section found for v9\.9\.9/);
}

function testFailsWhenVersionIsEmpty() {
  const { result } = runExtractor('v1.2.0', [
    '# Changelog',
    '',
    '## v1.2.0',
    '',
    '## v1.1.0',
    '',
    '- Older change',
    ''
  ].join('\n'));

  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /Changelog section for v1\.2\.0 is empty/);
}

testExtractsRequestedVersionOnly();
testFailsWhenVersionIsMissing();
testFailsWhenVersionIsEmpty();

console.log('PASS: release notes extractor tests');
