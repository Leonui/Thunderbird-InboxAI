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

  function replaceEditablePlainTextDraft(currentBody, replacementText) {
    const body = String(currentBody || '');
    const replacement = String(replacementText || '').trim();
    const quotePatterns = [
      /\n\s*On .+wrote:\s*\n/i,
      /\n\s*Le .+a écrit\s*:\s*\n/i,
      /\n\s*Am .+schrieb .+:\s*\n/i,
      /\n\s*-{2,}\s*Original Message\s*-{2,}\s*\n/i,
      /\n\s*-{2,}\s*Forwarded message\s*-{2,}\s*\n/i,
      /\n>/
    ];

    let quoteIndex = -1;
    for (const pattern of quotePatterns) {
      const match = body.match(pattern);
      if (match && (quoteIndex === -1 || match.index < quoteIndex)) {
        quoteIndex = match.index;
      }
    }

    if (quoteIndex === -1) {
      return {
        body: replacement,
        confidence: 'medium',
        reason: 'plain-text-no-quote-boundary',
        changed: true
      };
    }

    return {
      body: `${replacement}\n${body.substring(quoteIndex).replace(/^\n+/, '\n')}`,
      confidence: 'high',
      reason: 'plain-text-quote-boundary',
      changed: true
    };
  }

  function findHtmlQuoteBoundary(body) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(body || '', 'text/html');
    const quoteNode = doc.body.querySelector([
      'blockquote[type="cite"]',
      '.moz-cite-prefix',
      '.moz-forward-container',
      '.gmail_quote',
      '.yahoo_quoted',
      'blockquote'
    ].join(', '));

    if (!quoteNode) {
      return null;
    }

    if (Number.isInteger(quoteNode.__startIndex)) {
      return quoteNode.__startIndex;
    }

    const quoteHtml = quoteNode.outerHTML;
    const index = body.indexOf(quoteHtml);
    return index === -1 ? null : index;
  }

  function replaceEditableHtmlDraft(currentBody, replacementText) {
    const body = String(currentBody || '');
    const replacement = plainTextToHtml(replacementText);
    const quoteIndex = findHtmlQuoteBoundary(body);

    if (quoteIndex === null) {
      return {
        body,
        confidence: 'low',
        reason: 'html-no-quote-boundary',
        changed: false
      };
    }

    return {
      body: `${replacement}${body.substring(quoteIndex)}`,
      confidence: 'high',
      reason: 'html-quote-boundary',
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
