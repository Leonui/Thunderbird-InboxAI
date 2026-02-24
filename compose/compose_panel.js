const aiService = new window.AIService();
const promptInput = document.getElementById('prompt');
const btnWrite = document.getElementById('btn-write');
const btnPolish = document.getElementById('btn-polish');
const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');

const resultContainer = document.getElementById('result-container');
const resultText = document.getElementById('result-text');
const btnCopy = document.getElementById('btn-copy');

function setLoading(isLoading) {
  statusDiv.style.display = isLoading ? 'block' : 'none';
  btnWrite.disabled = isLoading;
  btnPolish.disabled = isLoading;
  errorDiv.textContent = '';
  if (isLoading) {
    resultContainer.style.display = 'none';
    resultText.value = '';
  }
}

function showResult(text) {
  resultText.value = text;
  resultContainer.style.display = 'block';
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

  const originalText = btnCopy.textContent;
  btnCopy.textContent = 'Copied!';
  setTimeout(() => {
    btnCopy.textContent = originalText;
  }, 1500);
});

btnWrite.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showError('Please enter a prompt.');
    return;
  }

  setLoading(true);
  try {
    const tabs = await messenger.tabs.query({ active: true, currentWindow: true });
    let context = '';
    if (tabs && tabs[0]) {
        context = await getReplyContext(tabs[0].id);
    }

    const generatedText = await aiService.write(prompt, context);
    showResult(generatedText);
  } catch (err) {
    showError(err.message);
    console.error(err);
  } finally {
    setLoading(false);
  }
});

// "Polish" functionality: reads current body, polishes it, and replaces it.
btnPolish.addEventListener('click', async () => {
  setLoading(true);
  try {
    const tabs = await messenger.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) {
        throw new Error('Could not find active compose tab.');
    }
    
    // We still need to read from the draft to polish it
    const tabId = tabs[0].id;
    const details = await messenger.compose.getComposeDetails(tabId);
    let currentBody = details.plainTextBody || details.body;

    if (!currentBody || currentBody.trim() === '') {
        showError('Draft body is empty.');
        setLoading(false);
        return;
    }

    const context = await getReplyContext(tabId);
    const polishedText = await aiService.polish(currentBody, context);
    showResult(polishedText);

  } catch (err) {
    showError(err.message);
    console.error(err);
  } finally {
    setLoading(false);
  }
});

async function getReplyContext(tabId) {
    try {
        const details = await messenger.compose.getComposeDetails(tabId);

        if (details.type === 'reply' || details.type === 'replyAll' || details.relatedMessageId) {
             if (details.relatedMessageId) {
                const fullMessage = await messenger.messages.getFull(details.relatedMessageId);
                let body = '';

                const findPart = (parts, targetType) => {
                    for (const part of parts) {
                        const type = (part.contentType || '').toLowerCase();
                        if (type.startsWith(targetType) && part.body) {
                            return part.body;
                        } else if (part.parts) {
                            const found = findPart(part.parts, targetType);
                            if (found) return found;
                        }
                    }
                    return null;
                };

                if (fullMessage.parts) {
                    body = findPart(fullMessage.parts, 'text/plain');

                    if (!body) {
                        const html = findPart(fullMessage.parts, 'text/html');
                        if (html) {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');
                            body = doc.body.textContent || doc.body.innerText || '';
                            if (!body) {
                                body = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                            }
                        }
                    }
                }

                if (!body && fullMessage.body) {
                    body = fullMessage.body;
                }

                body = body || '';
                return body.substring(0, 2000);
             }
        }
    } catch (e) {
        console.warn('Failed to get reply context:', e);
    }
    return '';
}
