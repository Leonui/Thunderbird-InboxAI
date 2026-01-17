const aiService = new window.AIService();
const btnTranslate = document.getElementById('btn-translate');
const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');
const resultDiv = document.getElementById('result');
const targetLangInput = document.getElementById('target-lang');

function setLoading(isLoading) {
  statusDiv.style.display = isLoading ? 'block' : 'none';
  btnTranslate.disabled = isLoading;
  errorDiv.textContent = '';
  if (isLoading) resultDiv.style.display = 'none';
}

function showError(msg) {
  errorDiv.textContent = msg;
}

function showResult(text) {
  resultDiv.textContent = text;
  resultDiv.style.display = 'block';
}

btnTranslate.addEventListener('click', async () => {
    const targetLang = targetLangInput.value.trim() || 'English';
    setLoading(true);
    
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            throw new Error('No active tab found.');
        }

        // Get the current message displayed in the active tab
        const messageHeader = await browser.messageDisplay.getDisplayedMessage(tabs[0].id);
        if (!messageHeader) {
            throw new Error('No message found. Please select an email.');
        }

        // Fetch the full message including body
        const fullMessage = await browser.messages.getFull(messageHeader.id);
        
        // Extract body - simplified. We might have multiple parts (html, plain).
        // We'll prefer plain text, or fallback to checking parts.
        let bodyText = '';
        if (fullMessage.parts) {
            // Very basic part traversal to find text/plain
            const findTextPart = (parts) => {
                for (const part of parts) {
                    if (part.contentType === 'text/plain' && part.body) {
                        return part.body;
                    }
                    if (part.parts) {
                        const found = findTextPart(part.parts);
                        if (found) return found;
                    }
                }
                return null;
            };
            
            // Also try to find html if plain not found, then strip tags? 
            // For now, let's try to find a text part or just use the first body we can find.
            bodyText = findTextPart(fullMessage.parts);
            
            // Fallback: if no text/plain, look for text/html and maybe we should translate that?
            // Sending raw HTML to AI might consume too many tokens or confuse it, but it's an option.
            if (!bodyText) {
                 // Try to strip HTML from the first part that has body
                 const firstPart = fullMessage.parts.find(p => p.body);
                 if (firstPart) bodyText = firstPart.body; // Logic to strip HTML could be added here
            }

        } else {
             // Sometimes top level has body if no parts
             bodyText = fullMessage.body; 
        }

        if (!bodyText) {
            throw new Error('Could not extract message text.');
        }

        // Limit body text to avoid huge token usage? 
        // For MVP, let's just send it.
        
        const translatedText = await aiService.translate(bodyText, targetLang);
        showResult(translatedText);

    } catch (err) {
        showError(err.message);
    } finally {
        setLoading(false);
    }
});
