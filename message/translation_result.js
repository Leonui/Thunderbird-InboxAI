document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const resultDiv = document.getElementById('result');
  const token = new URLSearchParams(window.location.search).get('token');
  const storageKey = token ? `pendingTranslation:${token}` : '';

  function setStatus(message, state = 'loading') {
    statusDiv.textContent = message || '';
    statusDiv.className = message ? `status ${state} visible` : 'status';
  }

  try {
    if (!storageKey) {
      throw new Error('No translation request found.');
    }

    const data = await browser.storage.local.get([storageKey, 'targetLang']);
    const request = data[storageKey];
    const text = request && request.text;
    const targetLang = data.targetLang || 'English';

    if (!text) {
      setStatus('No text to translate found.', 'error');
      return;
    }

    setStatus(request.truncated
      ? `Translating first ${text.length.toLocaleString()} characters to ${targetLang}...`
      : `Translating to ${targetLang}...`, 'loading');

    const aiService = new AIService();
    const translatedText = await aiService.translate(text, targetLang);

    setStatus('', '');
    resultDiv.textContent = translatedText;
    resultDiv.classList.add('visible');

  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error');
  } finally {
    if (storageKey) {
      await browser.storage.local.remove(storageKey);
    }
  }
});
