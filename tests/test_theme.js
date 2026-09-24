#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createPage({ storedTheme, hasOnChanged = true } = {}) {
  const attributes = {};
  let changeListener = null;
  const sandbox = {
    window: {},
    console,
    document: {
      documentElement: {
        setAttribute: (name, value) => { attributes[name] = value; },
        removeAttribute: (name) => { delete attributes[name]; }
      }
    },
    browser: {
      storage: {
        local: {
          get: async (defaults) => (storedTheme === undefined ? defaults : { theme: storedTheme })
        },
        onChanged: hasOnChanged ? { addListener: (fn) => { changeListener = fn; } } : undefined
      }
    }
  };

  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, '..', 'shared', 'theme.js'), 'utf8');
  vm.runInContext(source, sandbox);

  return {
    theme: sandbox.window.InboxAITheme,
    attributes,
    fireChange: (changes, area = 'local') => changeListener && changeListener(changes, area)
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

async function testSystemThemeLeavesNoOverride() {
  const page = createPage({});
  await tick();
  assert.strictEqual(page.attributes['data-theme'], undefined);
}

async function testStoredThemeIsAppliedOnLoad() {
  const page = createPage({ storedTheme: 'dark' });
  await tick();
  assert.strictEqual(page.attributes['data-theme'], 'dark');
}

async function testUnknownThemeFallsBackToSystem() {
  const page = createPage({ storedTheme: 'sepia' });
  await tick();
  assert.strictEqual(page.attributes['data-theme'], undefined);
  assert.strictEqual(page.theme.normalizeTheme('sepia'), 'system');
}

async function testStorageChangesUpdateTheLivePage() {
  const page = createPage({ storedTheme: 'light' });
  await tick();
  assert.strictEqual(page.attributes['data-theme'], 'light');

  page.fireChange({ theme: { newValue: 'dark' } });
  assert.strictEqual(page.attributes['data-theme'], 'dark');

  page.fireChange({ theme: { newValue: 'system' } });
  assert.strictEqual(page.attributes['data-theme'], undefined);

  page.fireChange({ theme: { newValue: 'dark' } }, 'sync');
  assert.strictEqual(page.attributes['data-theme'], undefined, 'other storage areas are ignored');
}

async function testWorksWithoutOnChangedApi() {
  const page = createPage({ storedTheme: 'dark', hasOnChanged: false });
  await tick();
  assert.strictEqual(page.attributes['data-theme'], 'dark');
}

async function run() {
  await testSystemThemeLeavesNoOverride();
  await testStoredThemeIsAppliedOnLoad();
  await testUnknownThemeFallsBackToSystem();
  await testStorageChangesUpdateTheLivePage();
  await testWorksWithoutOnChangedApi();
  console.log('PASS: theme tests');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
