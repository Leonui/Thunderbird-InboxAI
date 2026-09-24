class AIService {
  constructor() {
    this.defaultModel = 'gpt-4o-mini';
    this.requestTimeoutMs = 60000;
    this.testTimeoutMs = 30000;
  }

  async loadConfig() {
    const config = await browser.storage.local.get(['baseUrl', 'apiKey', 'modelName', 'dataOptIn']);
    const normalized = this.normalizeConfig(config);

    if (!normalized.baseUrl || !normalized.apiKey) {
      try {
        await browser.runtime.openOptionsPage();
      } catch (e) {
        console.error("Failed to open options page:", e);
      }
      throw new Error('Please configure the extension settings first.');
    }

    return normalized;
  }

  async generate(prompt, systemPrompt = 'You are a helpful email assistant.', options = {}) {
    const config = await this.loadConfig();

    if (!config.dataOptIn) {
      try {
        await browser.runtime.openOptionsPage();
      } catch (e) {
        console.error("Failed to open options page:", e);
      }
      throw new Error("Allow InboxAI to send email content in the Privacy & Data section of settings before using this feature.");
    }

    const requestBody = {
      model: config.modelName || this.defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: String(prompt || '') }
      ]
    };

    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : this.requestTimeoutMs;
    const data = await this.postChatCompletion(config, requestBody, timeoutMs);
    return this.extractMessageContent(data);
  }

  normalizeConfig(config) {
    return {
      baseUrl: String(config.baseUrl || '').trim().replace(/\/+$/, ''),
      apiKey: String(config.apiKey || '').trim(),
      modelName: String(config.modelName || this.defaultModel).trim() || this.defaultModel,
      dataOptIn: Boolean(config.dataOptIn)
    };
  }

  chatCompletionsUrl(baseUrl) {
    return `${baseUrl}/chat/completions`;
  }

  async postChatCompletion(config, requestBody, timeoutMs) {
    if (!this.isValidHttpUrl(config.baseUrl)) {
      throw new Error('Base URL must be a valid http or https URL.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.chatCompletionsUrl(config.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        throw await this.buildHttpError(response);
      }

      try {
        return await response.json();
      } catch (err) {
        throw new Error('AI provider returned invalid JSON.');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Please check your connection and try again.`);
      }
      if (err instanceof TypeError) {
        throw new Error('Could not reach the AI provider. Please check the Base URL and your network connection.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async buildHttpError(response) {
    let details = '';
    try {
      details = await response.text();
    } catch (err) {
      details = '';
    }

    const error = new Error(this.formatHttpError(response.status, details));
    error.status = response.status;
    error.details = details;
    return error;
  }

  formatHttpError(status, rawDetails) {
    let userMessage = `API Error (${status})`;
    const response = { status };

    if (response.status === 401 || response.status === 403) {
      userMessage = 'Authentication failed. Please check your API Key in settings.';
    } else if (response.status === 404) {
      userMessage = 'Endpoint not found. Please check the Base URL and Model Name.';
    } else if (response.status === 429) {
      userMessage = 'Rate limit exceeded. Please check your plan quota.';
    } else if (response.status >= 500) {
      userMessage = 'AI service error. Please try again later.';
    }

    const details = this.compactErrorDetails(rawDetails);
    return details ? `${userMessage} Details: ${details}` : userMessage;
  }

  // Providers usually answer with {"error": {"message": "..."}}; surface just
  // the message instead of the raw JSON envelope.
  extractErrorMessage(text) {
    const raw = String(text || '').trim();
    if (!raw.startsWith('{')) {
      return raw;
    }

    try {
      const parsed = JSON.parse(raw);
      const candidates = [
        parsed && parsed.error && parsed.error.message,
        parsed && typeof parsed.error === 'string' ? parsed.error : null,
        parsed && parsed.message,
        parsed && parsed.detail
      ];
      const message = candidates.find((value) => typeof value === 'string' && value.trim());
      return message ? message.trim() : raw;
    } catch (err) {
      return raw;
    }
  }

  compactErrorDetails(text) {
    const normalized = this.extractErrorMessage(text).replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }

    return normalized.length > 240 ? `${normalized.substring(0, 240)}...` : normalized;
  }

  extractMessageContent(data) {
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('AI provider returned an empty or unsupported response.');
    }

    return content.trim();
  }

  isValidHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  async polish(text, context = '') {
    const systemPrompt = "You are an expert editor. Polish the following email draft to be professional, clear, and concise. Maintain the original tone but improve grammar and flow. Output ONLY the polished text.";
    const fullPrompt = context ? `Context (replied email):\n${context}\n\nDraft to polish:\n${text}` : text;
    return this.generate(fullPrompt, systemPrompt);
  }

  async shorten(text, context = '') {
    const systemPrompt = "You are an expert email editor. Shorten the following email draft while preserving the key meaning, required details, and appropriate tone. Output ONLY the shortened email body.";
    const fullPrompt = context ? `Context (replied email):\n${context}\n\nDraft to shorten:\n${text}` : text;
    return this.generate(fullPrompt, systemPrompt);
  }

  async translate(text, targetLang = 'English') {
    const systemPrompt = `You are a professional translator. Translate the following email content into ${targetLang}. Output ONLY the translated text.`;
    return this.generate(text, systemPrompt);
  }

  async reply(prompt, context) {
    const systemPrompt = "You are an expert email writer. Draft a direct reply to the provided email context. Use the user's instruction if present. Output ONLY the reply email body.";
    const userInstruction = String(prompt || '').trim() || 'Draft a concise, professional reply.';
    return this.generate(`Email to reply to:\n${context}\n\nUser instruction:\n${userInstruction}`, systemPrompt);
  }

  async write(prompt, context = '') {
    const systemPrompt = "You are an expert email writer. Draft an email based on the user's request. Output ONLY the email body.";
    const fullPrompt = context ? `Context (replied email):\n${context}\n\nUser Request:\n${prompt}` : prompt;
    return this.generate(fullPrompt, systemPrompt);
  }

  async testConnection(baseUrl, apiKey, modelName) {
    const config = this.normalizeConfig({
      baseUrl,
      apiKey,
      modelName,
      dataOptIn: true
    });

    if (!config.baseUrl || !config.apiKey || !config.modelName) {
      throw new Error('Please fill in Base URL, API Key, and Model Name.');
    }

    const baseRequest = {
      model: config.modelName,
      messages: [{ role: 'user', content: 'test' }]
    };

    try {
      await this.postChatCompletion(config, { ...baseRequest, max_tokens: 5 }, this.testTimeoutMs);
    } catch (err) {
      // Newer OpenAI models (o-series, gpt-5) only accept max_completion_tokens,
      // while most OpenAI-compatible servers only know max_tokens. Try both.
      if (!this.rejectsMaxTokens(err)) {
        throw err;
      }
      await this.postChatCompletion(config, { ...baseRequest, max_completion_tokens: 5 }, this.testTimeoutMs);
    }

    return true;
  }

  rejectsMaxTokens(err) {
    return Boolean(err) && err.status === 400 && /max_tokens/i.test(String(err.details || ''));
  }
}

// Export for use in other modules (if using module system, otherwise global)
window.AIService = AIService;
