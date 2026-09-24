// Applies the user's Theme setting (system / light / dark) to the current page.
// "system" removes the override so the prefers-color-scheme rules in ui.css decide.
(function () {
  const THEMES = ['system', 'light', 'dark'];
  const DEFAULT_THEME = 'system';

  function normalizeTheme(value) {
    return THEMES.includes(value) ? value : DEFAULT_THEME;
  }

  function applyTheme(value) {
    const theme = normalizeTheme(value);
    const root = document.documentElement;
    if (theme === DEFAULT_THEME) {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    return theme;
  }

  async function loadTheme() {
    try {
      const stored = await browser.storage.local.get({ theme: DEFAULT_THEME });
      return applyTheme(stored.theme);
    } catch (err) {
      console.warn('Failed to load theme setting:', err);
      return applyTheme(DEFAULT_THEME);
    }
  }

  if (browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.theme) {
        applyTheme(changes.theme.newValue);
      }
    });
  }

  loadTheme();

  window.InboxAITheme = {
    THEMES,
    DEFAULT_THEME,
    normalizeTheme,
    applyTheme,
    loadTheme
  };
}());
