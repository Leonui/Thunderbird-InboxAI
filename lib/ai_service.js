class AIService {
  constructor() {
    this.config = null;
  }

  async loadConfig() {
    this.config = await browser.storage.local.get(['baseUrl', 'apiKey', 'modelName', 'dataOptIn']);
    if (!this.config.baseUrl || !this.config.apiKey) {
      try {
        await browser.runtime.openOptionsPage();
      } catch (e) {
        console.error("Failed to open options page:", e);
      }
      throw new Error('Please configure the extension settings first.');
    }
  }

  async generate(prompt, systemPrompt = 'You are a helpful email assistant.') {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config.dataOptIn) {
      // Try to open options page if possible (may be blocked by popup blocker depending on context)
      try {
        await browser.runtime.openOptionsPage();
      } catch (e) {
        console.error("Failed to open options page:", e);
      }
      throw new Error("Please click on the checkbox in 'Privacy & Data' section of InboxAI Settings to use this feature.");
    }

    const { baseUrl, apiKey, modelName } = this.config;
    // Remove trailing slash if present for cleaner URL construction
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const url = `${cleanBaseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ]
        }),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out after 60 seconds. Please check your connection and try again.');
      }
      throw err;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let userMessage = `API Error (${response.status})`;
      
      if (response.status === 401) {
        userMessage = "Authentication failed. Please check your API Key in settings.";
      } else if (response.status === 404) {
        userMessage = "Endpoint not found. Please check the Base URL and Model Name.";
      } else if (response.status === 429) {
        userMessage = "Rate limit exceeded. Please check your plan quota.";
      } else if (response.status >= 500) {
        userMessage = "AI Service internal error. Please try again later.";
      }

      throw new Error(`${userMessage} Details: ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async polish(text, context = '') {
    const systemPrompt = "You are an expert editor. Polish the following email draft to be professional, clear, and concise. Maintain the original tone but improve grammar and flow. Output ONLY the polished text.";
    const fullPrompt = context ? `Context (replied email):\n${context}\n\nDraft to polish:\n${text}` : text;
    return this.generate(fullPrompt, systemPrompt);
  }

  async translate(text, targetLang = 'English') {
    const systemPrompt = `You are a professional translator. Translate the following email content into ${targetLang}. Output ONLY the translated text.`;
    return this.generate(text, systemPrompt);
  }

  async write(prompt, context = '') {
    const systemPrompt = "You are an expert email writer. Draft an email based on the user's request. Output ONLY the email body.";
    const fullPrompt = context ? `Context (replied email):\n${context}\n\nUser Request:\n${prompt}` : prompt;
    return this.generate(fullPrompt, systemPrompt);
  }

  async testConnection(baseUrl, apiKey, modelName) {
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const url = `${cleanBaseUrl}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5
        }),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Connection timed out after 30 seconds.');
      }
      throw err;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status}: ${errorText}`);
    }

    return true;
  }
}

// Export for use in other modules (if using module system, otherwise global)
window.AIService = AIService;
