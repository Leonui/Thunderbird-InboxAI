#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const userFacingPages = [
  'popup/main_menu.html',
  'compose/compose_panel.html',
  'options/options.html',
  'message/translation_result.html',
  'rundown/rundown.html'
];

for (const page of userFacingPages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');

  assert.match(
    html,
    /<link\s+rel="stylesheet"\s+href="\.\.\/shared\/ui\.css">/,
    `${page} should load shared UI styles`
  );
  assert.match(
    html,
    /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1">/,
    `${page} should set a responsive viewport`
  );
  assert.doesNotMatch(html, /<style\b/i, `${page} should not use inline style blocks`);
  assert.doesNotMatch(html, /\sstyle="/i, `${page} should not use inline style attributes`);
  assert.doesNotMatch(html, /class="[^"]*(section-note|field-help)[^"]*"/i, `${page} should avoid helper microcopy`);

  const appHeaderBlocks = html.match(/<header[^>]*class="[^"]*app-header[^"]*"[\s\S]*?<\/header>/gi) || [];
  for (const headerBlock of appHeaderBlocks) {
    assert.doesNotMatch(headerBlock, /<p>/i, `${page} should keep headers terse`);
  }
}

console.log('PASS: UI markup regression tests');
