const defaultSettings = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-4o-mini',
  targetLang: 'English',
  rundownLang: 'English',
  rundownAccountIds: [],
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

document.querySelector('#test-connection').addEventListener('click', testConnection);

function setStatus(message, state) {
  const status = document.querySelector('#status');
  status.textContent = message;
  status.className = message ? `status ${state} visible` : 'status';
}

function renderAccountCheckboxes(accounts, configuredAccountIds) {
  const container = document.querySelector('#rundown-accounts-list');
  if (!container || typeof document.createElement !== 'function') {
    return;
  }

  container.innerHTML = '';

  if (!Array.isArray(accounts) || accounts.length === 0) {
    const emptyNote = document.createElement('p');
    emptyNote.className = 'accounts-empty';
    emptyNote.textContent = 'All configured Thunderbird mail accounts will be included automatically.';
    container.appendChild(emptyNote);
    return;
  }

  const enabledAccounts = window.InboxAIAccounts
    ? window.InboxAIAccounts.resolveEnabledAccounts(accounts, configuredAccountIds)
    : accounts;
  const enabledIds = new Set(enabledAccounts.map((acc) => String(acc.id)));

  for (const account of accounts) {
    const label = document.createElement('label');
    label.className = 'checkbox-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'rundownAccountIds';
    checkbox.value = account.id;
    checkbox.checked = enabledIds.has(String(account.id));

    const span = document.createElement('span');
    span.textContent = account.name;

    label.appendChild(checkbox);
    label.appendChild(span);
    container.appendChild(label);
  }
}

async function restoreOptions() {
  const res = await browser.storage.local.get(defaultSettings);
  document.querySelector('#provider').value = res.provider || 'openai';
  document.querySelector('#base-url').value = res.baseUrl;
  document.querySelector('#api-key').value = res.apiKey;
  document.querySelector('#model-name').value = res.modelName;
  document.querySelector('#target-lang').value = res.targetLang || 'English';
  document.querySelector('#rundown-lang').value = res.rundownLang || 'English';
  document.querySelector('#jev-api-key').value = res.jevApiKey || '';
  document.querySelector('#use-jev-for-rundown').checked = Boolean(res.useJevForRundown);
  document.querySelector('#data-opt-in').checked = res.dataOptIn || false;

  const accounts = window.InboxAIAccounts
    ? await window.InboxAIAccounts.listAccounts()
    : [];
  renderAccountCheckboxes(accounts, res.rundownAccountIds);
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
  const targetLang = document.querySelector('#target-lang').value;
  const rundownLang = document.querySelector('#rundown-lang').value;
  const jevApiKey = document.querySelector('#jev-api-key').value.trim();
  const useJevForRundown = document.querySelector('#use-jev-for-rundown').checked;
  const dataOptIn = document.querySelector('#data-opt-in').checked;

  let rundownAccountIds = [];
  const accountsContainer = document.querySelector('#rundown-accounts-list');
  if (accountsContainer && typeof accountsContainer.querySelectorAll === 'function') {
    const checkboxes = Array.from(accountsContainer.querySelectorAll('input[name="rundownAccountIds"]'));
    if (checkboxes.length > 0) {
      rundownAccountIds = checkboxes
        .filter((input) => input.checked)
        .map((input) => input.value);

      if (rundownAccountIds.length === 0) {
        setStatus('Please select at least one account for the Daily Rundown.', 'error');
        return;
      }
    }
  }

  browser.storage.local.set({
    provider,
    baseUrl,
    apiKey,
    modelName,
    targetLang,
    rundownLang,
    rundownAccountIds,
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
