const defaultSettings = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-4o-mini',
  targetLang: 'English',
  rundownLang: 'English',
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
    document.querySelector('#target-lang').value = res.targetLang || 'English';
    document.querySelector('#rundown-lang').value = res.rundownLang || 'English';
    document.querySelector('#data-opt-in').checked = res.dataOptIn || false;
  });
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

  setStatus('Testing connection...', 'loading');

  if (!baseUrl || !apiKey) {
    setStatus('Please fill in Base URL and API Key.', 'error');
    return;
  }

  try {
    const service = new window.AIService();
    await service.testConnection(baseUrl, apiKey, modelName);
    setStatus('Connection successful!', 'success');
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
  const targetLang = document.querySelector('#target-lang').value;
  const rundownLang = document.querySelector('#rundown-lang').value;
  const dataOptIn = document.querySelector('#data-opt-in').checked;

  browser.storage.local.set({
    provider,
    baseUrl,
    apiKey,
    modelName,
    targetLang,
    rundownLang,
    dataOptIn
  }).then(() => {
    setStatus('Options saved.', 'success');
    setTimeout(() => {
      setStatus('', '');
    }, 2000);
  });
}
