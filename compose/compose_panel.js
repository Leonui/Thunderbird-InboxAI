const aiService = new window.AIService();
const promptInput = document.getElementById('prompt');
const btnWrite = document.getElementById('btn-write');
const btnReply = document.getElementById('btn-reply');
const btnPolish = document.getElementById('btn-polish');
const btnShorten = document.getElementById('btn-shorten');
const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');

const resultContainer = document.getElementById('result-container');
const resultText = document.getElementById('result-text');
const btnInsert = document.getElementById('btn-insert');
const btnCopy = document.getElementById('btn-copy');
const MAX_PROMPT_CHARS = 4000;
const MAX_DRAFT_CHARS = 12000;
const MAX_CONTEXT_CHARS = 3000;

let activeComposeTabId = null;

function setStatus(message, state = 'loading') {
  statusDiv.textContent = message || '';
  statusDiv.className = message ? `status ${state} visible` : 'status';
}

function setButtonSuccess(button, message) {
  const originalText = button.textContent;
  button.textContent = message;
  button.classList.add('is-success');
  setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('is-success');
  }, 1500);
}

function appendNotice(message) {
  if (!message) {
    return;
  }

  setStatus(message, 'notice');
}

function setLoading(isLoading) {
  setStatus(isLoading ? 'Processing...' : '', 'loading');
  btnWrite.disabled = isLoading;
  btnReply.disabled = isLoading;
  btnPolish.disabled = isLoading;
  btnShorten.disabled = isLoading;
  btnInsert.disabled = isLoading;
  btnCopy.disabled = isLoading;
  if (isLoading) {
    errorDiv.textContent = '';
    resultContainer.classList.remove('visible');
    resultText.value = '';
  }
}

function showResult(text) {
  resultText.value = text;
  resultContainer.classList.add('visible');
}

function showError(msg) {
  errorDiv.textContent = msg;
}

btnCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultText.value);
  } catch (err) {
    resultText.select();
    document.execCommand('copy');
  }

  setButtonSuccess(btnCopy, 'Copied!');
});

btnInsert.addEventListener('click', async () => {
  try {
    const tabId = activeComposeTabId || await getActiveComposeTabId();
    const details = await messenger.compose.getComposeDetails(tabId);
    const currentBody = details.isPlainText === false
      ? details.body || ''
      : details.plainTextBody || '';
    const mergeResult = window.InboxAIText.replaceEditableDraft(currentBody, resultText.value, details);
    if (mergeResult.confidence === 'low') {
      throw new Error('Could not safely find the quoted reply boundary. Use Copy to Clipboard instead.');
    }

    const bodyDetails = details.isPlainText === false
      ? { body: mergeResult.body }
      : { plainTextBody: mergeResult.body };

    await messenger.compose.setComposeDetails(tabId, bodyDetails);

    setButtonSuccess(btnInsert, 'Inserted!');
  } catch (err) {
    showError(`Could not insert result: ${err.message}`);
    console.error(err);
  }
});

btnReply.addEventListener('click', async () => {
  const promptPayload = window.InboxAIText.truncateText(promptInput.value, MAX_PROMPT_CHARS);

  setLoading(true);
  let noticeMessage = '';
  try {
    activeComposeTabId = await getActiveComposeTabId();
    const context = await getReplyContext(activeComposeTabId);
    if (!context) {
      throw new Error('Reply context is unavailable for this compose window.');
    }

    const generatedText = await aiService.reply(promptPayload.text, context);
    showResult(generatedText);
    noticeMessage = promptPayload.truncated ? `Prompt was trimmed to ${MAX_PROMPT_CHARS.toLocaleString()} characters before sending.` : '';
  } catch (err) {
    showError(err.message);
    console.error(err);
  } finally {
    setLoading(false);
    appendNotice(noticeMessage);
  }
});

btnWrite.addEventListener('click', async () => {
  const promptPayload = window.InboxAIText.truncateText(promptInput.value, MAX_PROMPT_CHARS);
  if (!promptPayload.text) {
    showError('Please enter a prompt.');
    return;
  }

  setLoading(true);
  let noticeMessage = '';
  try {
    activeComposeTabId = await getActiveComposeTabId();
    let context = '';
    context = await getReplyContext(activeComposeTabId);

    const generatedText = await aiService.write(promptPayload.text, context);
    showResult(generatedText);
    noticeMessage = promptPayload.truncated ? `Prompt was trimmed to ${MAX_PROMPT_CHARS.toLocaleString()} characters before sending.` : '';
  } catch (err) {
    showError(err.message);
    console.error(err);
  } finally {
    setLoading(false);
    appendNotice(noticeMessage);
  }
});

btnPolish.addEventListener('click', async () => {
  polishOrShortenDraft('polish');
});

btnShorten.addEventListener('click', async () => {
  polishOrShortenDraft('shorten');
});

async function polishOrShortenDraft(action) {
  setLoading(true);
  let noticeMessage = '';
  try {
    const tabId = await getActiveComposeTabId();
    activeComposeTabId = tabId;
    const details = await messenger.compose.getComposeDetails(tabId);
    const draftBody = details.plainTextBody || (details.body ? window.InboxAIText.htmlToText(details.body) : '');
    const draftPayload = window.InboxAIText.truncateText(draftBody, MAX_DRAFT_CHARS);

    if (!draftPayload.text) {
        showError('Draft body is empty.');
        setLoading(false);
        return;
    }

    const context = await getReplyContext(tabId);
    const result = action === 'shorten'
      ? await aiService.shorten(draftPayload.text, context)
      : await aiService.polish(draftPayload.text, context);
    showResult(result);
    noticeMessage = draftPayload.truncated ? `Draft was trimmed to ${MAX_DRAFT_CHARS.toLocaleString()} characters before sending.` : '';

  } catch (err) {
    showError(err.message);
    console.error(err);
  } finally {
    setLoading(false);
    appendNotice(noticeMessage);
  }
}

async function getActiveComposeTabId() {
    const tabs = await messenger.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) {
        throw new Error('Could not find active compose tab.');
    }

    return tabs[0].id;
}

async function getReplyContext(tabId) {
    try {
        const details = await messenger.compose.getComposeDetails(tabId);

        if (details.type === 'reply' || details.type === 'replyAll' || details.relatedMessageId) {
             if (details.relatedMessageId) {
                const fullMessage = await messenger.messages.getFull(details.relatedMessageId);
                const body = window.InboxAIText.extractTextFromFullMessage(fullMessage);
                const payload = window.InboxAIText.truncateText(body, MAX_CONTEXT_CHARS);
                return payload.text;
             }
        }
    } catch (e) {
        console.warn('Failed to get reply context:', e);
    }
    return '';
}
