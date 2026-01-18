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

btnCopy.addEventListener('click', () => {
  resultText.select();
  document.execCommand('copy');
  // OR use navigator.clipboard if available in this context
  // navigator.clipboard.writeText(resultText.value); 
  // execCommand is safer for older extension contexts but clipboard API is standard.
  // navigator.clipboard works in popup if focused.
  
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
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
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
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0]) {
        throw new Error('Could not find active compose tab.');
    }
    
    // We still need to read from the draft to polish it
    const tabId = tabs[0].id;
    const details = await browser.compose.getComposeDetails(tabId);
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
        console.log('getReplyContext called for tabId:', tabId);
        const details = await browser.compose.getComposeDetails(tabId);
        console.log('Compose details:', details);

        if (details.type === 'reply' || details.type === 'replyAll' || details.relatedMessageId) {
             console.log('Is reply/replyAll or has relatedMessageId');
             if (details.relatedMessageId) {
                console.log('Found relatedMessageId:', details.relatedMessageId);
                
                // Try getting the full message
                const fullMessage = await browser.messages.getFull(details.relatedMessageId);
                console.log('Full message retrieved:', fullMessage);
                
                 let body = '';
                 
                 // Helper to find parts recursively
                 const findPart = (parts, targetType) => {
                     for (const part of parts) {
                         // Check strictly or startsWith since contentType can include charset
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
                    console.log('Searching for text/plain...');
                    body = findPart(fullMessage.parts, 'text/plain');
                    
                    if (!body) {
                        console.log('text/plain not found, searching for text/html...');
                        const html = findPart(fullMessage.parts, 'text/html');
                        if (html) {
                            console.log('text/html found, stripping tags...');
                            console.log('text/html found, stripping tags...');
                            // Simple HTML to Text using DOMParser
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');
                            body = doc.body.textContent || doc.body.innerText || '';
                            // Fallback regex if DOM manip fails in background (though this is panel, so valid)
                            if (!body) {
                                body = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                            }
                        }
                    }
                 }
                 
                 if (!body && fullMessage.body) {
                     console.log('Using simple body fallback');
                     body = fullMessage.body;
                 }
                 
                 console.log('Extracted context length:', body.length);
                 return body.substring(0, 2000); 
             } else {
                 console.log('No relatedMessageId found in details');
             }
        } else {
            console.log('Not a reply/replyAll type and no relatedMessageId');
        }
    } catch (e) {
        console.warn('Failed to get reply context:', e);
    }
    return '';
}
