#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// A tiny DOM stand-in: enough of DOMParser for the draft-replacement helpers
// (nested elements, class/type selectors, sibling removal, innerHTML).
const VOID_TAGS = new Set(['br', 'hr', 'img', 'meta', 'input']);

class FakeNode {
  constructor(type, props = {}) {
    this.nodeType = type;
    this.parentNode = null;
    this.childNodes = [];
    Object.assign(this, props);
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  appendChild(node) {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index === -1) {
      throw new Error('node is not a child');
    }
    this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }

  insertBefore(node, refNode) {
    if (refNode === null || refNode === undefined) {
      return this.appendChild(node);
    }
    const index = this.childNodes.indexOf(refNode);
    if (index === -1) {
      throw new Error('reference node is not a child');
    }
    node.parentNode = this;
    this.childNodes.splice(index, 0, node);
    return node;
  }

  matches(selector) {
    if (this.nodeType !== 1) {
      return false;
    }
    const attrMatch = selector.match(/^([a-z]+)\[type="([^"]+)"\]$/);
    if (attrMatch) {
      return this.tagName === attrMatch[1] && this.attrs.type === attrMatch[2];
    }
    if (selector.startsWith('.')) {
      return (this.attrs.class || '').split(/\s+/).includes(selector.slice(1));
    }
    return this.tagName === selector;
  }

  querySelector(selectors) {
    // Document order wins for a selector list, as in a real DOM.
    const list = selectors.split(',').map((item) => item.trim());
    return findFirst(this, (node) => list.some((selector) => node.matches(selector)));
  }

  get outerHTML() {
    if (this.nodeType === 3) {
      // Text parsed from markup is already escaped; created text nodes are serialized like a real DOM.
      return this.raw ? this.text : this.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    const attrs = Object.entries(this.attrs).map(([key, value]) => ` ${key}="${value}"`).join('');
    if (VOID_TAGS.has(this.tagName)) {
      return `<${this.tagName}${attrs}>`;
    }
    return `<${this.tagName}${attrs}>${this.innerHTML}</${this.tagName}>`;
  }

  get innerHTML() {
    return this.childNodes.map((node) => node.outerHTML).join('');
  }

  get textContent() {
    return this.nodeType === 3 ? this.text : this.childNodes.map((node) => node.textContent).join('');
  }
}

function findFirst(node, predicate) {
  for (const child of node.childNodes) {
    if (predicate(child)) {
      return child;
    }
    const nested = findFirst(child, predicate);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function parseFragment(html) {
  const root = new FakeNode(9, { tagName: 'body', attrs: {} });
  const stack = [root];
  const tokenPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|[^<]+/g;
  let match;
  while ((match = tokenPattern.exec(String(html || ''))) !== null) {
    const [token, tagName, rawAttrs] = match;
    const parent = stack[stack.length - 1];
    if (!tagName) {
      parent.appendChild(new FakeNode(3, { text: token, raw: true }));
      continue;
    }
    const tag = tagName.toLowerCase();
    if (token.startsWith('</')) {
      if (stack.length > 1 && stack[stack.length - 1].tagName === tag) {
        stack.pop();
      }
      continue;
    }
    const attrs = {};
    const attrPattern = /([a-zA-Z-]+)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(rawAttrs)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    const element = parent.appendChild(new FakeNode(1, { tagName: tag, attrs }));
    if (!VOID_TAGS.has(tag)) {
      stack.push(element);
    }
  }
  return root;
}

function loadHelpers() {
  const sandbox = {
    window: {},
    DOMParser: class {
      parseFromString(html) {
        const fragment = parseFragment(html);
        // Like a real parser, a full document resolves to its <body> element.
        const body = findFirst(fragment, (node) => node.tagName === 'body') || fragment;
        Object.defineProperty(body, 'innerText', { value: '' });
        return {
          body,
          createElement: (tagName) => new FakeNode(1, { tagName: tagName.toLowerCase(), attrs: {} }),
          createTextNode: (text) => new FakeNode(3, { text: String(text), raw: false })
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

  assert.strictEqual(merged.body, 'New draft<br><blockquote>quoted reply</blockquote>');
  assert.strictEqual(merged.confidence, 'high');
  assert.strictEqual(merged.reason, 'html-quote-boundary');
}

function testReplacesWholeHtmlDraftWhenNothingIsQuoted() {
  const helpers = loadHelpers();
  const merged = helpers.replaceEditableDraft('<div>Old draft only</div>', 'New draft', { isPlainText: false });

  assert.strictEqual(merged.body, 'New draft');

  const escaped = helpers.replaceEditableDraft('<div>Old</div>', 'a <b> & c', { isPlainText: false });
  assert.strictEqual(escaped.body, 'a &lt;b&gt; &amp; c');
  assert.strictEqual(merged.confidence, 'medium');
  assert.strictEqual(merged.reason, 'html-no-quote-boundary');
  assert.strictEqual(merged.changed, true);
}

function testKeepsThunderbirdCiteStructureWithoutStringMatching() {
  const helpers = loadHelpers();
  const body = [
    '<html><head><meta charset="utf-8"></head><body>',
    '<p>Old draft</p><br>',
    '<div class="moz-cite-prefix">On 2024-01-01, Alice wrote:</div>',
    '<blockquote type="cite" cite="mid:abc@example.com"><p>quoted</p></blockquote>',
    '<div class="moz-signature">-- <br>Tom</div>',
    '</body></html>'
  ].join('');

  const merged = helpers.replaceEditableDraft(body, 'Line one\nLine two', { isPlainText: false });

  assert.strictEqual(merged.body, [
    'Line one<br>Line two<br>',
    '<div class="moz-cite-prefix">On 2024-01-01, Alice wrote:</div>',
    '<blockquote type="cite" cite="mid:abc@example.com"><p>quoted</p></blockquote>',
    '<div class="moz-signature">-- <br>Tom</div>'
  ].join(''));
  assert.strictEqual(merged.confidence, 'high');
}

function testKeepsHtmlSignatureAboveQuoteAndWithoutQuote() {
  const helpers = loadHelpers();

  const aboveQuote = helpers.replaceEditableDraft(
    '<p>Old</p><div class="moz-signature">-- <br>Tom</div><blockquote type="cite">quoted</blockquote>',
    'New',
    { isPlainText: false }
  );
  assert.strictEqual(aboveQuote.body, 'New<br><div class="moz-signature">-- <br>Tom</div><blockquote type="cite">quoted</blockquote>');
  assert.strictEqual(aboveQuote.reason, 'html-signature-boundary');

  const newMail = helpers.replaceEditableDraft(
    '<p><br></p><div class="moz-signature">-- <br>Tom</div>',
    'New',
    { isPlainText: false }
  );
  assert.strictEqual(newMail.body, 'New<br><div class="moz-signature">-- <br>Tom</div>');
  assert.strictEqual(newMail.changed, true);
}

function testKeepsPlainTextSignature() {
  const helpers = loadHelpers();
  const merged = helpers.replaceEditableDraft('Old draft\n\n-- \nTom', 'New draft', { isPlainText: true });

  assert.strictEqual(merged.body, 'New draft\n\n-- \nTom');
  assert.strictEqual(merged.reason, 'plain-text-signature-boundary');
}

function run() {
  testPrefersNestedPlainText();
  testFallsBackToHtmlText();
  testConvertsHtmlToText();
  testTruncatesAndCollapsesWhitespace();
  testConvertsPlainTextToSafeHtml();
  testReplacesPlainTextReplyDraftAndPreservesQuote();
  testReplacesHtmlReplyDraftAndPreservesBlockquote();
  testReplacesWholeHtmlDraftWhenNothingIsQuoted();
  testKeepsThunderbirdCiteStructureWithoutStringMatching();
  testKeepsHtmlSignatureAboveQuoteAndWithoutQuote();
  testKeepsPlainTextSignature();
  console.log('PASS: message text helper tests');
}

run();
