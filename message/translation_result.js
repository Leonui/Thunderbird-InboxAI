document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const resultDiv = document.getElementById('result');

  try {
    const data = await browser.storage.local.get(['pendingTranslation', 'targetLang']);
    const text = data.pendingTranslation;
    const targetLang = data.targetLang || 'English';

    if (!text) {
        statusDiv.textContent = '';
        resultDiv.textContent = 'No text to translate found.';
        return;
    }

    statusDiv.textContent = `Translating to ${targetLang}...`;

    const aiService = new AIService();
    const translatedText = await aiService.translate(text, targetLang);

    statusDiv.style.display = 'none';
    resultDiv.textContent = translatedText;
    
    // Optional: Clear the pending translation
    browser.storage.local.remove('pendingTranslation');

  } catch (error) {
    statusDiv.className = 'error';
    statusDiv.textContent = `Error: ${error.message}`;
  }
});
