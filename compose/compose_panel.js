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
    const generatedText = await aiService.write(prompt);
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

    const polishedText = await aiService.polish(currentBody);
    showResult(polishedText);

  } catch (err) {
    showError(err.message);
    console.error(err);
  } finally {
    setLoading(false);
  }
});
