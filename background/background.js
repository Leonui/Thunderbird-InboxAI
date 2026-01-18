// Background script for Thunderbird AI Assistant
console.log("Thunderbird AI Assistant Background Script Loaded");

// Future expansion: Context Menus
browser.menus.create({
  id: "ai-translate-selection",
  title: "Translate Selection",
  contexts: ["selection"]
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "ai-translate-selection") {
    console.log("Translate selection clicked", info.selectionText);
    
    await browser.storage.local.set({
        pendingTranslation: info.selectionText
    });

    browser.windows.create({
        url: "message/translation_result.html",
        type: "popup",
        width: 400,
        height: 300
    });
  }
});
