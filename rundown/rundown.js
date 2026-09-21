const statusDiv = document.getElementById('status');
const reportDiv = document.getElementById('report');
const aiService = new window.AIService();
const jevService = new window.JevService();
const MAX_MESSAGES = 20;
const MAX_MESSAGE_SNIPPET_CHARS = 800;
const MAX_PAGES = 5;

function setStatus(message, state = 'loading') {
  statusDiv.textContent = message || '';
  statusDiv.className = message ? `status ${state} visible` : 'status';
}

function cleanAuthor(author) {
  let cleaned = author || 'Unknown';
  if (cleaned.includes('<')) {
    cleaned = cleaned.split('<')[0].replace(/"/g, '').trim();
  }

  return cleaned || 'Unknown';
}

function formatProbability(value) {
  return `${Math.round(value * 100)}%`;
}

function formatJevAnalysis(analysis) {
  const categoryLabels = {
    action_required: 'Action Required',
    meeting_or_calendar: 'Meeting or Calendar',
    important_update: 'Important Update',
    informational: 'Informational',
    low_priority: 'Low Priority',
    other_or_unclear: 'Other or Unclear'
  };

  return [
    `Suggested category: ${categoryLabels[analysis.category] || analysis.category}`,
    `Category confidence: ${formatProbability(analysis.categoryConfidence)}`,
    `Needs-reply probability: ${formatProbability(analysis.needsReplyProbability)}`,
    `Time-sensitive probability: ${formatProbability(analysis.timeSensitiveProbability)}`,
    `Priority score: ${analysis.priorityScore.toFixed(2)} of 2`,
    `Priority confidence: ${formatProbability(analysis.priorityConfidence)}`
  ];
}

async function getMessageSnippet(messageId) {
  try {
    const fullMessage = await messenger.messages.getFull(messageId);
    const body = window.InboxAIText.extractTextFromFullMessage(fullMessage);
    const payload = window.InboxAIText.truncateText(body, MAX_MESSAGE_SNIPPET_CHARS, { collapseWhitespace: true });
    return payload.text + (payload.truncated ? '...' : '');
  } catch (err) {
    console.warn('Failed to read message body for rundown:', err);
    return '';
  }
}

async function generateRundown() {
  try {
    setStatus('Fetching unread emails...', 'loading');
    
    const messages = await messenger.messages.query({ unread: true });
    
    let msgList = [];
    let page = messages;
    let pageCount = 0;

    while (page) {
      if (page.messages) {
        for (let m of page.messages) {
          msgList.push(m);
        }
      }
      pageCount++;
      if (page.id && pageCount < MAX_PAGES) {
        page = await messenger.messages.continueList(page.id);
      } else {
        break;
      }
    }

    if (msgList.length === 0) {
      setStatus('No unread emails found.', 'success');
      return;
    }

    msgList.sort((a, b) => b.date - a.date);

    const topMessages = msgList.slice(0, MAX_MESSAGES);
    
    setStatus(`Reading ${topMessages.length} unread emails...`, 'loading');

    const emailRecords = [];
    for (const [index, message] of topMessages.entries()) {
      setStatus(`Reading ${index + 1} of ${topMessages.length} unread emails...`, 'loading');
      const snippet = await getMessageSnippet(message.id);
      emailRecords.push({
        date: new Date(message.date).toLocaleDateString(),
        author: cleanAuthor(message.author),
        subject: message.subject || '(no subject)',
        snippet
      });
    }

    let jevFallbackMessage = '';
    let jevAnalyses = null;

    setStatus('Checking optional prioritization assistance...', 'loading');
    try {
      jevAnalyses = await jevService.analyzeRundownEmails(emailRecords);
      if (jevAnalyses) {
        for (let index = 0; index < emailRecords.length; index++) {
          emailRecords[index].jevAnalysis = jevAnalyses[index];
        }
      }
    } catch (err) {
      console.warn('JEV assistance failed; standard rundown will be used:', err);
      jevFallbackMessage = 'Smart prioritization was unavailable. The standard rundown was used.';
    }

    setStatus(`Analyzing ${topMessages.length} unread emails...`, 'loading');

    const emailData = emailRecords.map((message, index) => {
      const snippet = message.snippet || 'No text body was available.';
      const details = [
        `Email ${index + 1}`,
        `Date: ${message.date}`,
        `From: ${message.author}`,
        `Subject: ${message.subject}`,
        `Snippet: ${snippet}`
      ];

      if (message.jevAnalysis) {
        details.push(...formatJevAnalysis(message.jevAnalysis));
      }

      return details.join('\n');
    }).join('\n\n');

    const config = await browser.storage.local.get('rundownLang');
    let langInstruction = '';
    if (config.rundownLang) {
        langInstruction = `\n\n**Language Requirement:**\nPlease write the entire summary in **${config.rundownLang}**.\n`;
    }

    const jevInstruction = jevAnalyses ? `

    **Prioritization Hints:**
    Each email includes structured judgments from an assistive prioritization model. Use them as auxiliary evidence for categorization and prioritization. They are probabilistic signals, not facts. Prefer the email content when a signal is uncertain or conflicts with the provided text. Do not mention these hints or their scores in your output.
    ` : '';

    const prompt = `Here are bounded text snippets from the newest unread emails. Please provide a "Daily Rundown" summary.
    **Instructions:**
    ${langInstruction}
    ${jevInstruction}

    1. **Categorization**: Group emails into relevant categories such as:
      - Urgent/Time-Sensitive
      - Action Required
      - Important Updates
      - Meetings & Calendar
      - FYI/Informational
      - Low Priority

    2. **Formatting Requirements**:
      - Use "###" for section headers (maximum 3 hierarchy levels)
      - Use "- " for list items
      - Use **bold** for key senders, urgent items, and critical information
      - Keep summaries concise (1-2 sentences per email)

    3. **Content Guidelines**:
      - Identify and highlight time-sensitive items
      - Extract key action items or deadlines
      - Note important senders (executives, clients, team leads)
      - Summarize only facts supported by the provided snippets
      - Flag anything requiring immediate attention

    4. **Output Structure**:
    ### Overview
    - Summarize the unread scope and the most important themes.

    ### Needs Reply
    - **[Sender Name]**: [Brief reason this likely needs a response]

    ### [Category Name]
    - **[Sender Name]**: [Brief summary of email content]
    - **[Sender Name]**: [Brief summary with deadline/action if applicable]

    ### [Next Category]
    ...

    5. **Prioritization Logic**:
    - Emails with deadlines or time constraints go first
    - Direct requests or questions requiring response
    - Updates from leadership or key stakeholders
    - General announcements and newsletters last

    Please provide clear, scannable summaries that help the recipient quickly understand what needs attention and what can wait. If a snippet does not contain enough detail, say so briefly instead of inventing details.
        
    
    Unread email count analyzed: ${topMessages.length}
    Total unread returned by Thunderbird: ${msgList.length}

    Email snippets:
    ${emailData}`;

    const report = await aiService.generate(prompt, "You are a helpful executive assistant specialized in email productivity.");
    
    setStatus(jevFallbackMessage, '');
    
    // safe parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(parseMarkdown(report), 'text/html');
    reportDiv.innerHTML = '';
    // Append children safely
    while (doc.body.firstChild) {
        reportDiv.appendChild(doc.body.firstChild);
    }

  } catch (err) {
    console.error(err);
    setStatus('', '');
    reportDiv.innerHTML = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'error';
    errDiv.textContent = `Error: ${err.message}`;
    reportDiv.appendChild(errDiv);
  }
}

function parseMarkdown(text) {
  // SECURITY: Escape HTML entities FIRST to prevent injection from AI output
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Apply markdown transforms on escaped text
  html = html
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>');

  // Wrap consecutive <li> elements in <ul> tags
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    return '<ul>' + match + '</ul>';
  });

  return html.split('\n').map(line => {
    if (/<(h[23]|li|ul|\/ul)/.test(line)) return line;
    if (line.trim() === '') return '';
    return `<p>${line}</p>`;
  }).join('');
}

// Start immediately
generateRundown();
