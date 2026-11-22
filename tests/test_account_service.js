#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadAccountService() {
  const sandbox = {
    window: {},
    console
  };

  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'account_service.js'), 'utf8');
  vm.runInContext(source, sandbox);
  return sandbox.window.InboxAIAccounts;
}

async function testQueriesEachAccountIndependentlyAndBalancesSelection() {
  const service = loadAccountService();
  const accounts = [
    { id: 'acc1', name: 'Work Account', type: 'imap' },
    { id: 'acc2', name: 'Personal Account', type: 'imap' }
  ];

  const workMessages = Array.from({ length: 30 }, (_, index) => ({
    id: 1000 + index,
    date: new Date(2026, 10, 22, 12, 0, 0).getTime() - index * 60000,
    author: `Work Sender ${index}`,
    subject: `Work Subject ${index}`
  }));

  const personalMessages = [
    {
      id: 2001,
      date: new Date(2026, 10, 21, 9, 0, 0).getTime(),
      author: 'Personal Sender 1',
      subject: 'Family dinner'
    },
    {
      id: 2002,
      date: new Date(2026, 10, 20, 18, 30, 0).getTime(),
      author: 'Personal Sender 2',
      subject: 'Weekend plans'
    }
  ];

  const queries = [];
  const mailApi = {
    accounts: {
      list: async () => accounts
    },
    messages: {
      query: async (queryInfo) => {
        queries.push(queryInfo);
        if (queryInfo.accountId === 'acc1') {
          return { messages: workMessages };
        }
        if (queryInfo.accountId === 'acc2') {
          return { messages: personalMessages };
        }
        return { messages: [] };
      }
    }
  };

  const result = await service.collectUnreadMessages({
    mailApi,
    configuredAccountIds: [],
    selectedAccountId: 'all',
    maxMessages: 20,
    maxPagesPerAccount: 5
  });

  assert.strictEqual(queries.length, 2);
  assert.deepStrictEqual(
    queries.map((q) => q.accountId),
    ['acc1', 'acc2']
  );
  assert.strictEqual(result.totalUnreadCount, 32);
  assert.strictEqual(result.topMessages.length, 20);

  const personalIncluded = result.topMessages.filter((m) => m.accountId === 'acc2');
  const workIncluded = result.topMessages.filter((m) => m.accountId === 'acc1');
  assert.strictEqual(personalIncluded.length, 2, 'all unread messages from second account should be included');
  assert.strictEqual(workIncluded.length, 18, 'remaining slots should be filled from first account');
  assert.strictEqual(personalIncluded[0].accountName, 'Personal Account');
  assert.strictEqual(workIncluded[0].accountName, 'Work Account');
}

async function testRespectsConfiguredAccountIdsAndSingleAccountFilter() {
  const service = loadAccountService();
  const accounts = [
    { id: 'acc1', name: 'First Account' },
    { id: 'acc2', name: 'Second Account' },
    { id: 'acc3', name: 'Third Account' }
  ];

  const queriedAccounts = [];
  const mailApi = {
    accounts: {
      list: async () => accounts
    },
    messages: {
      query: async (queryInfo) => {
        queriedAccounts.push(queryInfo.accountId);
        return {
          messages: [
            {
              id: `msg-${queryInfo.accountId}`,
              date: Date.now(),
              author: 'Sender',
              subject: `Hello ${queryInfo.accountId}`
            }
          ]
        };
      }
    }
  };

  await service.collectUnreadMessages({
    mailApi,
    configuredAccountIds: ['acc2', 'acc3'],
    selectedAccountId: 'all',
    maxMessages: 20
  });

  assert.deepStrictEqual(queriedAccounts, ['acc2', 'acc3']);

  queriedAccounts.length = 0;
  await service.collectUnreadMessages({
    mailApi,
    configuredAccountIds: ['acc2', 'acc3'],
    selectedAccountId: 'acc1',
    maxMessages: 20
  });

  assert.deepStrictEqual(queriedAccounts, ['acc1']);
}

async function testFallsBackToFoldersWhenAccountIdQueryIsUnsupported() {
  const service = loadAccountService();
  const accounts = [
    {
      id: 'acc1',
      name: 'Legacy TB Account',
      folders: [
        { id: 'folder-inbox', name: 'Inbox', type: 'inbox' },
        { id: 'folder-trash', name: 'Trash', type: 'trash' }
      ]
    }
  ];

  const folderQueries = [];
  const mailApi = {
    accounts: {
      list: async () => accounts
    },
    messages: {
      query: async (queryInfo) => {
        if (queryInfo.accountId) {
          throw new Error('Unexpected property "accountId"');
        }
        folderQueries.push(queryInfo.folderId);
        return {
          messages: [
            {
              id: 501,
              date: Date.now(),
              author: 'Alice',
              subject: 'Fallback message'
            }
          ]
        };
      }
    }
  };

  const result = await service.collectUnreadMessages({
    mailApi,
    selectedAccountId: 'all'
  });

  assert.deepStrictEqual(folderQueries, ['folder-inbox']);
  assert.strictEqual(result.topMessages.length, 1);
  assert.strictEqual(result.topMessages[0].accountName, 'Legacy TB Account');
}

async function run() {
  await testQueriesEachAccountIndependentlyAndBalancesSelection();
  await testRespectsConfiguredAccountIdsAndSingleAccountFilter();
  await testFallsBackToFoldersWhenAccountIdQueryIsUnsupported();
  console.log('PASS: AccountService multi-account tests');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
