document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const resultDiv = document.getElementById('result');
  const token = new URLSearchParams(window.location.search).get('token');
  const storageKey = token ? `pendingTranslation:${token}` : '';

  try {
    if (!storageKey) {
      throw new Error('No translation request found.');
    }

    const data = await browser.storage.local.get([storageKey, 'targetLang']);
    const request = data[storageKey];
    const text = request && request.text;
    const targetLang = data.targetLang || 'English';

    if (!text) {
      statusDiv.textContent = '';
      resultDiv.textContent = 'No text to translate found.';
      return;
    }

    statusDiv.textContent = request.truncated
      ? `Translating first ${text.length.toLocaleString()} characters to ${targetLang}...`
      : `Translating to ${targetLang}...`;

    const aiService = new AIService();
    const translatedText = await aiService.translate(text, targetLang);

    statusDiv.style.display = 'none';
    resultDiv.textContent = translatedText;

  } catch (error) {
    statusDiv.className = 'error';
    statusDiv.textContent = `Error: ${error.message}`;
  } finally {
    if (storageKey) {
      await browser.storage.local.remove(storageKey);
    }
  }
});
