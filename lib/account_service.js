(function () {
  function getMailApi(customApi) {
    if (customApi) {
      return customApi;
    }
    if (typeof messenger !== 'undefined') {
      return messenger;
    }
    if (typeof browser !== 'undefined') {
      return browser;
    }
    return null;
  }

  function flattenFolders(folders, result = []) {
    if (!Array.isArray(folders)) {
      return result;
    }

    for (const folder of folders) {
      if (!folder) {
        continue;
      }
      result.push(folder);
      if (Array.isArray(folder.subFolders) && folder.subFolders.length > 0) {
        flattenFolders(folder.subFolders, result);
      }
    }

    return result;
  }

  function extractAccountFolders(account) {
    if (!account) {
      return [];
    }
    if (Array.isArray(account.folders) && account.folders.length > 0) {
      return flattenFolders(account.folders);
    }
    if (account.rootFolder && Array.isArray(account.rootFolder.subFolders)) {
      return flattenFolders(account.rootFolder.subFolders);
    }
    return [];
  }

  async function listAccounts(customApi) {
    const api = getMailApi(customApi);
    if (!api || !api.accounts || typeof api.accounts.list !== 'function') {
      return [];
    }

    try {
      const rawAccounts = await api.accounts.list();
      if (!Array.isArray(rawAccounts)) {
        return [];
      }

      return rawAccounts
        .filter((account) => account && account.id)
        .map((account) => ({
          id: String(account.id),
          name: String(account.name || account.id).trim() || String(account.id),
          type: String(account.type || ''),
          folders: extractAccountFolders(account)
        }));
    } catch (err) {
      console.warn('Failed to list Thunderbird accounts:', err);
      return [];
    }
  }

  function resolveEnabledAccounts(accounts, configuredAccountIds) {
    const list = Array.isArray(accounts) ? accounts : [];
    if (!Array.isArray(configuredAccountIds) || configuredAccountIds.length === 0) {
      return list.slice();
    }

    const allowed = new Set(configuredAccountIds.map((id) => String(id)));
    const filtered = list.filter((account) => allowed.has(String(account.id)));
    return filtered.length > 0 ? filtered : list.slice();
  }

  function resolveTargetAccounts(accounts, configuredAccountIds, selectedAccountId = 'all') {
    const list = Array.isArray(accounts) ? accounts : [];
    if (selectedAccountId && selectedAccountId !== 'all') {
      const match = list.find((account) => String(account.id) === String(selectedAccountId));
      if (match) {
        return [match];
      }
    }

    return resolveEnabledAccounts(list, configuredAccountIds);
  }

  async function collectPagedMessages(api, firstPage, maxPages = 5) {
    const messages = [];
    let page = firstPage;
    let pageCount = 0;

    while (page) {
      if (Array.isArray(page.messages)) {
        for (const message of page.messages) {
          messages.push(message);
        }
      }
      pageCount += 1;
      if (page.id && pageCount < maxPages && api.messages && typeof api.messages.continueList === 'function') {
        page = await api.messages.continueList(page.id);
      } else {
        break;
      }
    }

    return messages;
  }

  function toTimestamp(dateValue) {
    if (dateValue instanceof Date) {
      return dateValue.getTime();
    }
    if (typeof dateValue === 'number') {
      return dateValue;
    }
    const parsed = new Date(dateValue).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sortMessagesNewestFirst(messages) {
    return messages.slice().sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
  }

  function annotateAndDeduplicateMessages(messages, account, seenIds) {
    const annotated = [];
    for (const message of messages) {
      if (!message) {
        continue;
      }
      if (
        account &&
        message.folder &&
        message.folder.accountId &&
        String(message.folder.accountId) !== String(account.id)
      ) {
        continue;
      }

      const key = message.id !== undefined && message.id !== null
        ? `${account ? account.id : ''}:${message.id}`
        : null;
      if (key && seenIds.has(key)) {
        continue;
      }
      if (key) {
        seenIds.add(key);
      }

      const resolvedAccountName = account
        ? account.name
        : (message.accountName || (message.folder && message.folder.accountId) || '');

      annotated.push(Object.assign({}, message, {
        accountId: account ? account.id : (message.accountId || (message.folder && message.folder.accountId) || ''),
        accountName: resolvedAccountName
      }));
    }

    return sortMessagesNewestFirst(annotated);
  }

  async function queryUnreadByAccountFolders(api, account, maxPages) {
    const folders = Array.isArray(account.folders) ? account.folders : [];
    const eligibleFolders = folders.filter((folder) => {
      const folderType = String(folder.type || '').toLowerCase();
      return folderType !== 'trash' && folderType !== 'junk';
    });

    if (eligibleFolders.length === 0) {
      const page = await api.messages.query({ unread: true });
      const allMessages = await collectPagedMessages(api, page, maxPages);
      return allMessages.filter(
        (msg) => msg && msg.folder && String(msg.folder.accountId) === String(account.id)
      );
    }

    const collected = [];
    for (const folder of eligibleFolders) {
      let page = null;
      try {
        if (folder.id) {
          page = await api.messages.query({ folderId: folder.id, unread: true });
        } else {
          page = await api.messages.query({ folder, unread: true });
        }
      } catch (err) {
        page = await api.messages.query({ folder, unread: true });
      }
      const folderMessages = await collectPagedMessages(api, page, maxPages);
      collected.push(...folderMessages);
    }

    return collected;
  }

  async function queryAccountUnreadMessages(customApi, account, maxPages = 5) {
    const api = getMailApi(customApi);
    if (!api || !api.messages || typeof api.messages.query !== 'function') {
      return [];
    }

    const seenIds = new Set();
    let rawMessages = [];

    try {
      const firstPage = await api.messages.query({
        accountId: account.id,
        unread: true
      });
      rawMessages = await collectPagedMessages(api, firstPage, maxPages);
    } catch (err) {
      rawMessages = await queryUnreadByAccountFolders(api, account, maxPages);
    }

    return annotateAndDeduplicateMessages(rawMessages, account, seenIds);
  }

  function selectBalancedMessages(perAccountLists, maxMessages = 20) {
    const nonEmptyLists = (Array.isArray(perAccountLists) ? perAccountLists : [])
      .map((list) => sortMessagesNewestFirst(Array.isArray(list) ? list : []))
      .filter((list) => list.length > 0);

    if (nonEmptyLists.length === 0 || maxMessages <= 0) {
      return [];
    }

    const selected = [];
    const seenMessageIds = new Set();
    let round = 0;

    while (selected.length < maxMessages) {
      const roundCandidates = [];
      for (const list of nonEmptyLists) {
        if (round < list.length) {
          roundCandidates.push(list[round]);
        }
      }

      if (roundCandidates.length === 0) {
        break;
      }

      roundCandidates.sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));

      for (const candidate of roundCandidates) {
        if (selected.length >= maxMessages) {
          break;
        }
        const idKey = candidate.id !== undefined && candidate.id !== null
          ? String(candidate.id)
          : null;
        if (idKey && seenMessageIds.has(idKey)) {
          continue;
        }
        if (idKey) {
          seenMessageIds.add(idKey);
        }
        selected.push(candidate);
      }

      round += 1;
    }

    return sortMessagesNewestFirst(selected);
  }

  async function collectUnreadMessages(options = {}) {
    const api = getMailApi(options.mailApi);
    const maxMessages = Number.isInteger(options.maxMessages) ? options.maxMessages : 20;
    const maxPagesPerAccount = Number.isInteger(options.maxPagesPerAccount) ? options.maxPagesPerAccount : 5;
    const selectedAccountId = options.selectedAccountId || 'all';
    const configuredAccountIds = Array.isArray(options.configuredAccountIds) ? options.configuredAccountIds : [];
    const accounts = Array.isArray(options.accounts) ? options.accounts : await listAccounts(api);

    const targetAccounts = resolveTargetAccounts(accounts, configuredAccountIds, selectedAccountId);

    if (targetAccounts.length === 0) {
      const firstPage = await api.messages.query({ unread: true });
      const rawMessages = await collectPagedMessages(api, firstPage, maxPagesPerAccount);
      const accountNameById = new Map(accounts.map((acc) => [String(acc.id), acc.name]));
      const annotated = annotateAndDeduplicateMessages(rawMessages, null, new Set()).map((msg) => {
        const folderAccountId = msg.folder && msg.folder.accountId ? String(msg.folder.accountId) : '';
        return Object.assign({}, msg, {
          accountId: msg.accountId || folderAccountId,
          accountName: msg.accountName || accountNameById.get(folderAccountId) || ''
        });
      });

      return {
        topMessages: annotated.slice(0, maxMessages),
        totalUnreadCount: annotated.length,
        targetAccounts: [],
        accountsWithUnread: []
      };
    }

    const perAccountLists = [];
    const accountsWithUnread = [];
    let totalUnreadCount = 0;

    for (const account of targetAccounts) {
      const accountMessages = await queryAccountUnreadMessages(api, account, maxPagesPerAccount);
      totalUnreadCount += accountMessages.length;
      if (accountMessages.length > 0) {
        perAccountLists.push(accountMessages);
        accountsWithUnread.push({
          id: account.id,
          name: account.name,
          unreadCount: accountMessages.length
        });
      }
    }

    const topMessages = selectBalancedMessages(perAccountLists, maxMessages);

    return {
      topMessages,
      totalUnreadCount,
      targetAccounts,
      accountsWithUnread
    };
  }

  window.InboxAIAccounts = {
    listAccounts,
    resolveEnabledAccounts,
    resolveTargetAccounts,
    queryAccountUnreadMessages,
    selectBalancedMessages,
    collectUnreadMessages
  };
}());
