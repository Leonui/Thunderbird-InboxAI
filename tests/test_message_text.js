#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadHelpers() {
  const sandbox = {
    window: {},
    DOMParser: class {
      parseFromString(html) {
        const body = {
          innerHTML: String(html || ''),
          querySelector(selectors) {
            const selectorList = selectors.split(',').map((selector) => selector.trim());
            for (const selector of selectorList) {
              let match = null;
              if (selector === 'blockquote[type="cite"]') {
                match = this.innerHTML.match(/<blockquote\b[^>]*type="cite"[^>]*>/i);
              } else if (selector === 'blockquote') {
                match = this.innerHTML.match(/<blockquote\b[^>]*>/i);
              } else if (selector === '.moz-cite-prefix') {
                match = this.innerHTML.match(/<[^>]*class="[^"]*moz-cite-prefix[^"]*"[^>]*>/i);
              } else if (selector === '.gmail_quote') {
                match = this.innerHTML.match(/<[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>/i);
              } else if (selector === '.yahoo_quoted') {
                match = this.innerHTML.match(/<[^>]*class="[^"]*yahoo_quoted[^"]*"[^>]*>/i);
              } else if (selector === '.moz-forward-container') {
                match = this.innerHTML.match(/<[^>]*class="[^"]*moz-forward-container[^"]*"[^>]*>/i);
              }

              if (match) {
                return {
                  __startIndex: match.index,
                  outerHTML: this.innerHTML.substring(match.index)
                };
              }
            }

            return null;
          },
          textContent: String(html || '').replace(/<[^>]*>/g, ' '),
          innerText: ''
        };

        return {
          body
        };
      }
    }
  };

  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'message_text.js'), 'utf8');
  vm.runInContext(source, sandbox);
  return sandbox.window.InboxAIText;
}

function testPrefersNestedPlainText() {
  const helpers = loadHelpers();
  const text = helpers.extractTextFromFullMessage({
    parts: [
      {
        contentType: 'multipart/alternative',
        parts: [
          { contentType: 'text/html', body: '<p>html body</p>' },
          { contentType: 'text/plain', body: 'plain body' }
        ]
      }
    ]
  });

  assert.strictEqual(text, 'plain body');
}

function testFallsBackToHtmlText() {
  const helpers = loadHelpers();
  const text = helpers.extractTextFromFullMessage({
    parts: [
      { contentType: 'text/html', body: '<p>Hello <strong>world</strong></p>' }
    ]
  });

  assert.match(text, /Hello/);
  assert.match(text, /world/);
}

function testConvertsHtmlToText() {
  const helpers = loadHelpers();
  const text = helpers.htmlToText('<p>Hello <strong>world</strong></p>');

  assert.match(text, /Hello/);
  assert.match(text, /world/);
}

function testTruncatesAndCollapsesWhitespace() {
  const helpers = loadHelpers();
  const payload = helpers.truncateText('  a\n\n b   c  ', 5, { collapseWhitespace: true });

  assert.strictEqual(payload.text, 'a b c');
  assert.strictEqual(payload.truncated, false);
}

function testConvertsPlainTextToSafeHtml() {
  const helpers = loadHelpers();
  const html = helpers.plainTextToHtml('Hello <team>\nUse "quotes" & apostrophes');

  assert.strictEqual(html, 'Hello &lt;team&gt;<br>Use &quot;quotes&quot; &amp; apostrophes');
}

function testReplacesPlainTextReplyDraftAndPreservesQuote() {
  const helpers = loadHelpers();
  const body = [
    'Old draft',
    '',
    'On Monday, Alice wrote:',
    '> quoted line'
  ].join('\n');

  const merged = helpers.replaceEditableDraft(body, 'New draft', { isPlainText: true });

  assert.strictEqual(merged.body, [
    'New draft',
    '',
    'On Monday, Alice wrote:',
    '> quoted line'
  ].join('\n'));
  assert.strictEqual(merged.confidence, 'high');
}

function testReplacesHtmlReplyDraftAndPreservesBlockquote() {
  const helpers = loadHelpers();
  const body = '<div>Old draft</div><blockquote>quoted reply</blockquote>';
  const merged = helpers.replaceEditableDraft(body, 'New draft', { isPlainText: false });

  assert.strictEqual(merged.body, 'New draft<blockquote>quoted reply</blockquote>');
  assert.strictEqual(merged.confidence, 'high');
  assert.strictEqual(merged.reason, 'html-quote-boundary');
}

function testRefusesLowConfidenceHtmlReplacement() {
  const helpers = loadHelpers();
  const merged = helpers.replaceEditableDraft('<div>Old draft only</div>', 'New draft', { isPlainText: false });

  assert.strictEqual(merged.body, '<div>Old draft only</div>');
  assert.strictEqual(merged.confidence, 'low');
  assert.strictEqual(merged.changed, false);
}

function run() {
  testPrefersNestedPlainText();
  testFallsBackToHtmlText();
  testConvertsHtmlToText();
  testTruncatesAndCollapsesWhitespace();
  testConvertsPlainTextToSafeHtml();
  testReplacesPlainTextReplyDraftAndPreservesQuote();
  testReplacesHtmlReplyDraftAndPreservesBlockquote();
  testRefusesLowConfidenceHtmlReplacement();
  console.log('PASS: message text helper tests');
}

run();
