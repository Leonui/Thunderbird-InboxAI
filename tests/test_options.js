#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createOptions({ useJevForRundown, jevApiKey, accountCheckboxes = null }) {
  const values = {
    '#provider': { value: 'openai' },
    '#base-url': { value: 'https://api.example.com/v1' },
    '#api-key': { value: 'provider-key' },
    '#model-name': { value: 'model' },
    '#target-lang': { value: 'English' },
    '#rundown-lang': { value: 'English' },
    '#jev-api-key': { value: jevApiKey },
    '#use-jev-for-rundown': { checked: useJevForRundown },
    '#data-opt-in': { checked: true },
    '#test-connection': {},
    '#status': { textContent: '', className: '' },
    'form': {}
  };

  if (accountCheckboxes) {
    values['#rundown-accounts-list'] = {
      querySelectorAll: () => accountCheckboxes
    };
  }

  for (const element of Object.values(values)) {
    element.addEventListener = () => {};
  }

  const calls = { provider: 0, jev: 0, saved: null };
  const sandbox = {
    window: {
      AIService: class {
        async testConnection() {
          calls.provider += 1;
        }
      },
      JevService: class {
        async testConnection(key) {
          calls.jev += 1;
          calls.jevKey = key;
        }
      }
    },
    document: {
      addEventListener: () => {},
      querySelector: (selector) => values[selector]
    },
    browser: {
      storage: {
        local: {
          get: async () => ({}),
          set: async (payload) => {
            calls.saved = payload;
          }
        }
      }
    },
    setTimeout: () => {}
  };

  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, '..', 'options', 'options.js'), 'utf8');
  vm.runInContext(source, sandbox);

  return {
    testConnection: sandbox.testConnection,
    saveOptions: sandbox.saveOptions,
    calls,
    status: values['#status']
  };
}

async function testJevIsSkippedWhenUnchecked() {
  const options = createOptions({ useJevForRundown: false, jevApiKey: 'jev-key' });
  await options.testConnection();

  assert.strictEqual(options.calls.provider, 1);
  assert.strictEqual(options.calls.jev, 0);
  assert.strictEqual(options.status.textContent, 'Connection successful!');
}

async function testJevIsTestedWhenChecked() {
  const options = createOptions({ useJevForRundown: true, jevApiKey: 'jev-key' });
  await options.testConnection();

  assert.strictEqual(options.calls.provider, 1);
  assert.strictEqual(options.calls.jev, 1);
  assert.strictEqual(options.calls.jevKey, 'jev-key');
  assert.strictEqual(options.status.textContent, 'Connections successful!');
}

async function testCheckedJevRequiresAKeyBeforeRequests() {
  const options = createOptions({ useJevForRundown: true, jevApiKey: '' });
  await options.testConnection();

  assert.strictEqual(options.calls.provider, 0);
  assert.strictEqual(options.calls.jev, 0);
  assert.match(options.status.textContent, /JEV API Key/);
}

async function testSaveOptionsStoresSelectedAccountsAndRejectsEmptySelection() {
  const options = createOptions({
    useJevForRundown: false,
    jevApiKey: '',
    accountCheckboxes: [
      { value: 'acc1', checked: true },
      { value: 'acc2', checked: false },
      { value: 'acc3', checked: true }
    ]
  });

  await options.saveOptions({ preventDefault: () => {} });
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(options.calls.saved.rundownAccountIds)),
    ['acc1', 'acc3']
  );

  const emptyOptions = createOptions({
    useJevForRundown: false,
    jevApiKey: '',
    accountCheckboxes: [
      { value: 'acc1', checked: false },
      { value: 'acc2', checked: false }
    ]
  });

  await emptyOptions.saveOptions({ preventDefault: () => {} });
  assert.strictEqual(emptyOptions.calls.saved, null);
  assert.match(emptyOptions.status.textContent, /select at least one account/i);
}

async function run() {
  await testJevIsSkippedWhenUnchecked();
  await testJevIsTestedWhenChecked();
  await testCheckedJevRequiresAKeyBeforeRequests();
  await testSaveOptionsStoresSelectedAccountsAndRejectsEmptySelection();
  console.log('PASS: options connection tests');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
