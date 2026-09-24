(function () {
  function truncateText(text, maxChars, options = {}) {
    const raw = String(text || '');
    const normalized = options.collapseWhitespace ? raw.replace(/\s+/g, ' ').trim() : raw.trim();

    if (normalized.length <= maxChars) {
      return {
        text: normalized,
        truncated: false
      };
    }

    return {
      text: normalized.substring(0, maxChars),
      truncated: true
    };
  }

  function findMessagePart(parts, targetType) {
    for (const part of parts || []) {
      const type = (part.contentType || '').toLowerCase();
      if (type.startsWith(targetType) && part.body) {
        return part.body;
      }

      if (part.parts) {
        const found = findMessagePart(part.parts, targetType);
        if (found) {
          return found;
        }
      }
    }

    return '';
  }

  function htmlToText(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || '', 'text/html');
    return doc.body.textContent || doc.body.innerText || String(html || '').replace(/<[^>]*>/g, ' ');
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function plainTextToHtml(text) {
    return escapeHtml(text).replace(/\r?\n/g, '<br>');
  }

  const PLAIN_TEXT_QUOTE_PATTERNS = [
    /\n\s*On .+wrote:\s*\n/i,
    /\n\s*Le .+a écrit\s*:\s*\n/i,
    /\n\s*Am .+schrieb .+:\s*\n/i,
    /\n\s*-{2,}\s*Original Message\s*-{2,}\s*\n/i,
    /\n\s*-{2,}\s*Forwarded message\s*-{2,}\s*\n/i,
    /\n>/
  ];
  const PLAIN_TEXT_SIGNATURE_PATTERN = /(?:^|\n)-- \r?\n/;
  const HTML_QUOTE_SELECTOR = [
    'blockquote[type="cite"]',
    '.moz-cite-prefix',
    '.moz-forward-container',
    '.gmail_quote',
    '.yahoo_quoted',
    'blockquote'
  ].join(', ');
  const HTML_SIGNATURE_SELECTOR = '.moz-signature';

  function earliestMatchIndex(body, patterns) {
    let earliest = -1;
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match && (earliest === -1 || match.index < earliest)) {
        earliest = match.index;
      }
    }

    return earliest;
  }

  function replaceEditablePlainTextDraft(currentBody, replacementText) {
    const body = String(currentBody || '');
    const replacement = String(replacementText || '').trim();
    const quoteIndex = earliestMatchIndex(body, PLAIN_TEXT_QUOTE_PATTERNS);
    const signatureIndex = earliestMatchIndex(body, [PLAIN_TEXT_SIGNATURE_PATTERN]);

    let boundaryIndex = quoteIndex;
    let reason = 'plain-text-quote-boundary';
    let confidence = 'high';
    if (signatureIndex !== -1 && (boundaryIndex === -1 || signatureIndex < boundaryIndex)) {
      boundaryIndex = signatureIndex;
      reason = 'plain-text-signature-boundary';
      confidence = 'medium';
    }

    if (boundaryIndex === -1) {
      return {
        body: replacement,
        confidence: 'medium',
        reason: 'plain-text-no-quote-boundary',
        changed: true
      };
    }

    return {
      body: `${replacement}\n${body.substring(boundaryIndex).replace(/^\n+/, '\n')}`,
      confidence,
      reason,
      changed: true
    };
  }

  function topLevelAncestor(node, root) {
    let current = node;
    while (current && current.parentNode && current.parentNode !== root) {
      current = current.parentNode;
    }

    return current && current.parentNode === root ? current : null;
  }

  function precedes(root, a, b) {
    for (const child of Array.from(root.childNodes)) {
      if (child === a) {
        return true;
      }
      if (child === b) {
        return false;
      }
    }

    return false;
  }

  // Insert plain text before refNode as text nodes separated by <br>, so no
  // HTML string ever has to be parsed into the draft document.
  function insertPlainTextBefore(doc, parent, refNode, text) {
    const lines = String(text || '').trim().split(/\r?\n/);
    lines.forEach((line, index) => {
      if (index > 0) {
        parent.insertBefore(doc.createElement('br'), refNode);
      }
      if (line) {
        parent.insertBefore(doc.createTextNode(line), refNode);
      }
    });
  }

  function replaceEditableHtmlDraft(currentBody, replacementText) {
    const body = String(currentBody || '');
    const parser = new DOMParser();
    const doc = parser.parseFromString(body, 'text/html');
    const root = doc.body;

    const quoteNode = root.querySelector(HTML_QUOTE_SELECTOR);
    const signatureNode = root.querySelector(HTML_SIGNATURE_SELECTOR);
    const quoteBoundary = quoteNode ? topLevelAncestor(quoteNode, root) : null;
    const signatureBoundary = signatureNode ? topLevelAncestor(signatureNode, root) : null;

    let boundary = quoteBoundary;
    let reason = 'html-quote-boundary';
    let confidence = 'high';
    if (signatureBoundary && (!boundary || precedes(root, signatureBoundary, boundary))) {
      boundary = signatureBoundary;
      reason = 'html-signature-boundary';
      confidence = 'medium';
    }
    if (!boundary) {
      reason = 'html-no-quote-boundary';
      confidence = 'medium';
    }

    // Everything before the boundary is the editable draft: drop it and put the
    // replacement in its place. The quote and signature are kept as DOM nodes,
    // so no string matching against serialized markup is needed.
    while (root.firstChild && root.firstChild !== boundary) {
      root.removeChild(root.firstChild);
    }
    insertPlainTextBefore(doc, root, boundary, replacementText);
    if (boundary) {
      root.insertBefore(doc.createElement('br'), boundary);
    }

    return {
      body: root.innerHTML,
      confidence,
      reason,
      changed: true
    };
  }

  function replaceEditableDraft(currentBody, replacementText, details = {}) {
    if (details.isPlainText === false) {
      return replaceEditableHtmlDraft(currentBody, replacementText);
    }

    return replaceEditablePlainTextDraft(currentBody, replacementText);
  }

  function extractTextFromFullMessage(fullMessage) {
    if (!fullMessage) {
      return '';
    }

    let body = findMessagePart(fullMessage.parts, 'text/plain');

    if (!body) {
      const html = findMessagePart(fullMessage.parts, 'text/html');
      body = html ? htmlToText(html) : '';
    }

    if (!body && fullMessage.body) {
      body = fullMessage.body;
    }

    return body || '';
  }

  window.InboxAIText = {
    truncateText,
    extractTextFromFullMessage,
    htmlToText,
    plainTextToHtml,
    replaceEditableDraft
  };
}());
