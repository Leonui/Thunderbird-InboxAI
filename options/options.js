const defaultSettings = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-4o-mini',
  targetLang: 'English',
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

function restoreOptions() {
  browser.storage.local.get(defaultSettings).then((res) => {
    document.querySelector('#provider').value = res.provider || 'openai';
    document.querySelector('#base-url').value = res.baseUrl;
    document.querySelector('#api-key').value = res.apiKey;
    document.querySelector('#model-name').value = res.modelName;
    document.querySelector('#target-lang').value = res.targetLang || 'English';
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
  const status = document.querySelector('#status');
  const baseUrl = document.querySelector('#base-url').value;
  const apiKey = document.querySelector('#api-key').value;
  const modelName = document.querySelector('#model-name').value;
  
  status.textContent = 'Testing connection...';
  status.classList.add('visible');
  status.style.color = '#333';

  if (!baseUrl || !apiKey) {
      status.textContent = 'Please fill in Base URL and API Key.';
      status.style.color = 'red';
      return;
  }

  try {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const url = `${cleanBaseUrl}/chat/completions`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5
        })
    });

    if (response.ok) {
        status.textContent = 'Connection successful!';
        status.style.color = 'green';
    } else {
        const errorText = await response.text();
        status.textContent = `Error: ${response.status}`;
        console.error('Test failed:', errorText);
        status.style.color = 'red';
    }
  } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.style.color = 'red';
  }
}


function saveOptions(e) {
  e.preventDefault();
  const provider = document.querySelector('#provider').value;
  const baseUrl = document.querySelector('#base-url').value;
  const apiKey = document.querySelector('#api-key').value;
  const modelName = document.querySelector('#model-name').value;
  const targetLang = document.querySelector('#target-lang').value;
  const dataOptIn = document.querySelector('#data-opt-in').checked;

  browser.storage.local.set({
    provider,
    baseUrl,
    apiKey,
    modelName,
    targetLang,
    dataOptIn
  }).then(() => {
    const status = document.querySelector('#status');
    status.textContent = 'Options saved.';
    status.classList.add('visible');
    setTimeout(() => {
      status.classList.remove('visible');
    }, 2000);
  });
}
