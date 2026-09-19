#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createService({ storageConfig, fetchImpl }) {
  const sandbox = {
    window: {},
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: fetchImpl,
    browser: {
      storage: {
        local: {
          get: async () => Object.assign({}, storageConfig)
        }
      }
    }
  };

  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'jev_service.js'), 'utf8');
  vm.runInContext(source, sandbox);
  return new sandbox.window.JevService();
}

function okJson(content) {
  return {
    ok: true,
    status: 200,
    json: async () => content
  };
}

const sampleEmail = {
  date: '9/19/2026',
  author: 'Alex <alex@example.com>',
  subject: 'Please review before Friday',
  snippet: 'Could you review the attached proposal before Friday?'
};

const sampleResponse = {
  model: 'jev-1.13.0',
  answers: {
    category: {
      type: 'choice',
      choice: 'action_required',
      confidence: 0.91,
      probabilities: { action_required: 0.94, other_or_unclear: 0.06 }
    },
    needs_reply: { type: 'noul', noul: 0.88 },
    time_sensitive: { type: 'noul', noul: 0.82 },
    priority: {
      type: 'score',
      score: 1.7,
      confidence: 0.79,
      legend: { 0: 'Low', 1: 'Normal', 2: 'High' },
      probabilities: { 0: 0.02, 1: 0.26, 2: 0.72 }
    }
  },
  usage: { input_tokens: 200, output_tokens: 20 }
};

async function testDisabledSettingsDoNotCallJev() {
  for (const storageConfig of [
    { jevApiKey: 'key', useJevForRundown: false, dataOptIn: true },
    { jevApiKey: '', useJevForRundown: true, dataOptIn: true },
    { jevApiKey: 'key', useJevForRundown: true, dataOptIn: false }
  ]) {
    let fetchCount = 0;
    const service = createService({
      storageConfig,
      fetchImpl: async () => {
        fetchCount += 1;
        return okJson(sampleResponse);
      }
    });

    assert.strictEqual(await service.analyzeRundownEmails([sampleEmail]), null);
    assert.strictEqual(fetchCount, 0);
  }
}

async function testEnabledSettingsReturnTypedJudgments() {
  const requests = [];
  const apiKey = process.env.JEV_API || 'test-jev-key';
  const service = createService({
    storageConfig: {
      jevApiKey: apiKey,
      useJevForRundown: true,
      dataOptIn: true
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return okJson(sampleResponse);
    }
  });

  const analyses = await service.analyzeRundownEmails([sampleEmail]);

  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].url, 'https://api.typesafe.ai/v1/systemone');
  assert.strictEqual(requests[0].options.headers.Authorization, `Bearer ${apiKey}`);
  assert.strictEqual(requests[0].body.model, 'jev-latest');
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(requests[0].body.state)),
    {
      email: {
        date: sampleEmail.date,
        from: sampleEmail.author,
        subject: sampleEmail.subject,
        body_excerpt: sampleEmail.snippet
      }
    }
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(analyses)),
    [{
      category: 'action_required',
      categoryConfidence: 0.91,
      needsReplyProbability: 0.88,
      timeSensitiveProbability: 0.82,
      priorityScore: 1.7,
      priorityConfidence: 0.79
    }]
  );
}

async function testInvalidResponseIsRejected() {
  const service = createService({
    storageConfig: {
      jevApiKey: 'test-key',
      useJevForRundown: true,
      dataOptIn: true
    },
    fetchImpl: async () => okJson({ answers: {} })
  });

  await assert.rejects(
    () => service.analyzeRundownEmails([sampleEmail]),
    /invalid response/
  );
}

async function testAuthenticationErrorDoesNotExposeKey() {
  const apiKey = 'do-not-leak-this-key';
  const service = createService({
    storageConfig: {
      jevApiKey: apiKey,
      useJevForRundown: true,
      dataOptIn: true
    },
    fetchImpl: async () => ({ ok: false, status: 401 })
  });

  await assert.rejects(
    () => service.analyzeRundownEmails([sampleEmail]),
    (err) => {
      assert.match(err.message, /authentication failed/i);
      assert.doesNotMatch(err.message, new RegExp(apiKey));
      return true;
    }
  );
}

async function testConnectionUsesOneSyntheticQuestion() {
  const requests = [];
  const service = createService({
    storageConfig: {},
    fetchImpl: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return okJson({
        model: 'jev-1.13.0',
        answers: {
          connection: { type: 'noul', noul: 1 }
        },
        usage: { input_tokens: 20, output_tokens: 1 }
      });
    }
  });

  assert.strictEqual(await service.testConnection('test-connection-key'), true);
  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0].body.state, 'InboxAI JEV connection test.');
  assert.deepStrictEqual(
    Object.keys(requests[0].body.questions),
    ['connection']
  );
  assert.strictEqual(requests[0].options.headers.Authorization, 'Bearer test-connection-key');
}

async function testConnectionRejectsMissingKeyWithoutFetching() {
  let fetchCount = 0;
  const service = createService({
    storageConfig: {},
    fetchImpl: async () => {
      fetchCount += 1;
      return okJson({});
    }
  });

  await assert.rejects(() => service.testConnection('  '), /JEV API Key/);
  assert.strictEqual(fetchCount, 0);
}

async function run() {
  await testDisabledSettingsDoNotCallJev();
  await testEnabledSettingsReturnTypedJudgments();
  await testInvalidResponseIsRejected();
  await testAuthenticationErrorDoesNotExposeKey();
  await testConnectionUsesOneSyntheticQuestion();
  await testConnectionRejectsMissingKeyWithoutFetching();
  console.log('PASS: JevService regression tests');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
