const defaultSettings = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-4o-mini',
  theme: 'system',
  targetLang: 'English',
  rundownLang: 'English',
  jevApiKey: '',
  useJevForRundown: false,
  dataOptIn: false
};

const providers = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4o-mini'
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    modelName: 'deepseek-chat'
  },
  custom: {
    baseUrl: '',
    modelName: ''
  }
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector('form').addEventListener('submit', saveOptions);
document.querySelector('#provider').addEventListener('change', handleProviderChange);
document.querySelector('#theme').addEventListener('change', handleThemeChange);

document.querySelector('#test-connection').addEventListener('click', testConnection);

function setStatus(message, state) {
  const status = document.querySelector('#status');
  status.textContent = message;
  status.className = message ? `status ${state} visible` : 'status';
}

function restoreOptions() {
  browser.storage.local.get(defaultSettings).then((res) => {
    document.querySelector('#provider').value = res.provider || 'openai';
    document.querySelector('#base-url').value = res.baseUrl;
    document.querySelector('#api-key').value = res.apiKey;
    document.querySelector('#model-name').value = res.modelName;
    document.querySelector('#theme').value = normalizeTheme(res.theme);
    document.querySelector('#target-lang').value = res.targetLang || 'English';
    document.querySelector('#rundown-lang').value = res.rundownLang || 'English';
    document.querySelector('#jev-api-key').value = res.jevApiKey || '';
    document.querySelector('#use-jev-for-rundown').checked = Boolean(res.useJevForRundown);
    document.querySelector('#data-opt-in').checked = res.dataOptIn || false;

    // Show the optional section expanded when the user has already set it up.
    const jevDetails = document.querySelector('#jev-details');
    if (jevDetails && (res.jevApiKey || res.useJevForRundown)) {
      jevDetails.open = true;
    }
  });
}

function normalizeTheme(value) {
  return window.InboxAITheme ? window.InboxAITheme.normalizeTheme(value) : (value || 'system');
}

// Preview the theme immediately; it is persisted on Save.
function handleThemeChange(e) {
  if (window.InboxAITheme) {
    window.InboxAITheme.applyTheme(e.target.value);
  }
}

function handleProviderChange(e) {
  const provider = e.target.value;
  if (provider !== 'custom' && providers[provider]) {
    document.querySelector('#base-url').value = providers[provider].baseUrl;
    document.querySelector('#model-name').value = providers[provider].modelName;
  }
}

async function testConnection() {
  const baseUrl = document.querySelector('#base-url').value;
  const apiKey = document.querySelector('#api-key').value;
  const modelName = document.querySelector('#model-name').value;
  const jevApiKey = document.querySelector('#jev-api-key').value.trim();
  const useJevForRundown = document.querySelector('#use-jev-for-rundown').checked;

  setStatus('Testing connection...', 'loading');

  if (!baseUrl || !apiKey) {
    setStatus('Please fill in Base URL and API Key.', 'error');
    return;
  }

  if (useJevForRundown && !jevApiKey) {
    setStatus('Please fill in the JEV API Key.', 'error');
    return;
  }

  try {
    const service = new window.AIService();
    await service.testConnection(baseUrl, apiKey, modelName);

    if (useJevForRundown) {
      const jevService = new window.JevService();
      await jevService.testConnection(jevApiKey);
    }

    setStatus(useJevForRundown ? 'Connections successful!' : 'Connection successful!', 'success');
  } catch (err) {
    setStatus(`Error: ${err.message}`, 'error');
  }
}


function saveOptions(e) {
  e.preventDefault();
  const provider = document.querySelector('#provider').value;
  const baseUrl = document.querySelector('#base-url').value;
  const apiKey = document.querySelector('#api-key').value;
  const modelName = document.querySelector('#model-name').value;
  const theme = normalizeTheme(document.querySelector('#theme').value);
  const targetLang = document.querySelector('#target-lang').value;
  const rundownLang = document.querySelector('#rundown-lang').value;
  const jevApiKey = document.querySelector('#jev-api-key').value.trim();
  const useJevForRundown = document.querySelector('#use-jev-for-rundown').checked;
  const dataOptIn = document.querySelector('#data-opt-in').checked;

  browser.storage.local.set({
    provider,
    baseUrl,
    apiKey,
    modelName,
    theme,
    targetLang,
    rundownLang,
    jevApiKey,
    useJevForRundown,
    dataOptIn
  }).then(() => {
    setStatus('Options saved.', 'success');
    setTimeout(() => {
      setStatus('', '');
    }, 2000);
  });
}
