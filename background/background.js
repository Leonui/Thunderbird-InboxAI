const TRANSLATION_STORAGE_PREFIX = 'pendingTranslation:';
const MAX_SELECTION_CHARS = 12000;

function trimForTranslation(text) {
  return window.InboxAIText.truncateText(text, MAX_SELECTION_CHARS);
}

browser.menus.create({
  id: "ai-translate-selection",
  title: "InboxAI-Translate",
  contexts: ["selection"],
  icons: {
    "32": "icons/inboxai.svg"
  }
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ai-translate-selection") {
    const payload = trimForTranslation(info.selectionText);
    if (!payload.text) {
      return;
    }

    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storageKey = `${TRANSLATION_STORAGE_PREFIX}${token}`;

    await browser.storage.local.set({
      [storageKey]: {
        text: payload.text,
        truncated: payload.truncated,
        createdAt: Date.now()
      }
    });

    try {
      await browser.windows.create({
        url: `message/translation_result.html?token=${encodeURIComponent(token)}`,
        type: "popup",
        width: 500,
        height: 420
      });
    } catch (err) {
      await browser.storage.local.remove(storageKey);
      throw err;
    }
  }
});
