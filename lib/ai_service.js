class AIService {
  constructor() {
    this.config = null;
  }

  async loadConfig() {
    this.config = await browser.storage.local.get(['baseUrl', 'apiKey', 'modelName']);
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('Please configure the extension settings first.');
    }
  }

  async generate(prompt, systemPrompt = 'You are a helpful email assistant.') {
    if (!this.config) {
      await this.loadConfig();
    }

    const { baseUrl, apiKey, modelName } = this.config;
    // Remove trailing slash if present for cleaner URL construction
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    const url = `${cleanBaseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });

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

  async polish(text) {
    const systemPrompt = "You are an expert editor. Polish the following email draft to be professional, clear, and concise. Maintain the original tone but improve grammar and flow. Output ONLY the polished text.";
    return this.generate(text, systemPrompt);
  }

  async translate(text, targetLang = 'English') {
    const systemPrompt = `You are a professional translator. Translate the following email content into ${targetLang}. Output ONLY the translated text.`;
    return this.generate(text, systemPrompt);
  }

  async write(prompt) {
    const systemPrompt = "You are an expert email writer. Draft an email based on the user's request. Output ONLY the email body.";
    return this.generate(prompt, systemPrompt);
  }
}

// Export for use in other modules (if using module system, otherwise global)
window.AIService = AIService;
