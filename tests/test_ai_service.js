#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createService({ storageConfig, fetchImpl }) {
  let openOptionsCount = 0;
  const sandbox = {
    window: {},
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    URL,
    fetch: fetchImpl,
    browser: {
      runtime: {
        openOptionsPage: async () => {
          openOptionsCount += 1;
        }
      },
      storage: {
        local: {
          get: async () => {
            if (typeof storageConfig === 'function') {
              return storageConfig();
            }
            return Object.assign({}, storageConfig);
          }
        }
      }
    }
  };

  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'ai_service.js'), 'utf8');
  vm.runInContext(source, sandbox);

  return {
    service: new sandbox.window.AIService(),
    getOpenOptionsCount: () => openOptionsCount
  };
}

function okJson(content) {
  return {
    ok: true,
    status: 200,
    json: async () => content
  };
}

async function testReloadsSettingsForEachRequest() {
  let model = 'first-model';
  const requests = [];
  const { service } = createService({
    storageConfig: () => ({
      baseUrl: 'https://api.example.com/v1/',
      apiKey: 'secret',
      modelName: model,
      dataOptIn: true
    }),
    fetchImpl: async (url, options) => {
      requests.push({
        url,
        body: JSON.parse(options.body)
      });
      return okJson({ choices: [{ message: { content: 'ok' } }] });
    }
  });

  await service.generate('hello');
  model = 'second-model';
  await service.generate('hello again');

  assert.strictEqual(requests.length, 2);
  assert.strictEqual(requests[0].url, 'https://api.example.com/v1/chat/completions');
  assert.strictEqual(requests[0].body.model, 'first-model');
  assert.strictEqual(requests[1].body.model, 'second-model');
}

async function testMalformedProviderResponseHasHelpfulError() {
  const { service } = createService({
    storageConfig: {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'secret',
      modelName: 'model',
      dataOptIn: true
    },
    fetchImpl: async () => okJson({ choices: [] })
  });

  await assert.rejects(
    () => service.generate('hello'),
    /AI provider returned an empty or unsupported response/
  );
}

async function testProviderErrorsDoNotDumpLargeBodies() {
  const body = 'x'.repeat(1200);
  const { service } = createService({
    storageConfig: {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'secret',
      modelName: 'model',
      dataOptIn: true
    },
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => body
    })
  });

  await assert.rejects(
    () => service.generate('hello'),
    (err) => {
      assert.match(err.message, /Authentication failed/);
      assert.ok(err.message.length < 500, `error was too long: ${err.message.length}`);
      return true;
    }
  );
}

async function testMissingOptInOpensOptionsAndDoesNotFetch() {
  let fetchCount = 0;
  const { service, getOpenOptionsCount } = createService({
    storageConfig: {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'secret',
      modelName: 'model',
      dataOptIn: false
    },
    fetchImpl: async () => {
      fetchCount += 1;
      return okJson({ choices: [{ message: { content: 'ok' } }] });
    }
  });

  await assert.rejects(
    () => service.generate('hello'),
    /Allow InboxAI to send email content/
  );
  assert.strictEqual(fetchCount, 0);
  assert.strictEqual(getOpenOptionsCount(), 1);
}

async function testProviderErrorShowsMessageNotJsonEnvelope() {
  const { service } = createService({
    storageConfig: {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'secret',
      modelName: 'model',
      dataOptIn: true
    },
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Incorrect API key provided', type: 'invalid_request_error' } })
    })
  });

  await assert.rejects(
    () => service.generate('hello'),
    (err) => {
      assert.strictEqual(err.message, 'Authentication failed. Please check your API Key in settings. Details: Incorrect API key provided');
      assert.strictEqual(err.status, 401);
      return true;
    }
  );
}

async function testConnectionRetriesWithMaxCompletionTokens() {
  const bodies = [];
  const { service } = createService({
    storageConfig: {},
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      bodies.push(body);
      if ('max_tokens' in body) {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." } })
        };
      }
      return okJson({ choices: [{ message: { content: 'ok' } }] });
    }
  });

  assert.strictEqual(await service.testConnection('https://api.example.com/v1', 'secret', 'gpt-5-mini'), true);
  assert.strictEqual(bodies.length, 2);
  assert.strictEqual(bodies[0].max_tokens, 5);
  assert.strictEqual(bodies[1].max_completion_tokens, 5);
  assert.strictEqual('max_tokens' in bodies[1], false);
}

async function testConnectionDoesNotRetryOtherBadRequests() {
  let fetchCount = 0;
  const { service } = createService({
    storageConfig: {},
    fetchImpl: async () => {
      fetchCount += 1;
      return {
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: 'model not found' } })
      };
    }
  });

  await assert.rejects(
    () => service.testConnection('https://api.example.com/v1', 'secret', 'nope'),
    /model not found/
  );
  assert.strictEqual(fetchCount, 1);
}

async function testGenerateHonoursTimeoutOverride() {
  let receivedSignal = null;
  const { service } = createService({
    storageConfig: {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'secret',
      modelName: 'model',
      dataOptIn: true
    },
    fetchImpl: async (url, options) => {
      receivedSignal = options.signal;
      return okJson({ choices: [{ message: { content: 'ok' } }] });
    }
  });

  await service.generate('hello', 'system', { timeoutMs: 120000 });
  assert.ok(receivedSignal, 'request should carry an abort signal');
  assert.strictEqual(receivedSignal.aborted, false);
}

async function run() {
  await testReloadsSettingsForEachRequest();
  await testProviderErrorShowsMessageNotJsonEnvelope();
  await testConnectionRetriesWithMaxCompletionTokens();
  await testConnectionDoesNotRetryOtherBadRequests();
  await testGenerateHonoursTimeoutOverride();
  await testMalformedProviderResponseHasHelpfulError();
  await testProviderErrorsDoNotDumpLargeBodies();
  await testMissingOptInOpensOptionsAndDoesNotFetch();
  console.log('PASS: AIService regression tests');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
