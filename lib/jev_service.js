class JevService {
  constructor() {
    this.endpoint = 'https://api.typesafe.ai/v1/systemone';
    this.model = 'jev-latest';
    this.requestTimeoutMs = 30000;
    this.maxConcurrentRequests = 4;
  }

  async loadConfig() {
    const config = await browser.storage.local.get([
      'jevApiKey',
      'useJevForRundown',
      'dataOptIn'
    ]);

    return {
      apiKey: String(config.jevApiKey || '').trim(),
      enabled: Boolean(config.useJevForRundown),
      dataOptIn: Boolean(config.dataOptIn)
    };
  }

  async analyzeRundownEmails(emails) {
    const config = await this.loadConfig();
    if (!config.apiKey || !config.enabled || !config.dataOptIn) {
      return null;
    }

    // Bounded concurrency: a burst of 20 parallel calls is the quickest way to
    // hit a rate limit and lose every judgment at once.
    const results = new Array(emails.length);
    let next = 0;
    const worker = async () => {
      while (next < emails.length) {
        const index = next++;
        results[index] = await this.analyzeEmail(emails[index], config.apiKey);
      }
    };
    const workers = Array.from(
      { length: Math.min(this.maxConcurrentRequests, emails.length) },
      () => worker()
    );
    await Promise.all(workers);
    return results;
  }

  async analyzeEmail(email, apiKey) {
    const requestBody = {
      model: this.model,
      state: {
        email: {
          date: String(email.date || ''),
          from: String(email.author || ''),
          subject: String(email.subject || ''),
          body_excerpt: String(email.snippet || '')
        }
      },
      questions: {
        category: {
          type: 'choice',
          instructions: 'Which single category best describes the primary purpose of `email`?',
          criteria: {
            action_required: 'The recipient is asked to reply, decide, review, provide information, or complete a task.',
            meeting_or_calendar: 'The primary purpose is scheduling, changing, or discussing a meeting or calendar event.',
            important_update: 'A meaningful status, policy, account, project, or relationship update that should be noticed.',
            informational: 'Useful information that does not require a response or immediate action.',
            low_priority: 'Routine notification, newsletter, promotion, or other content that can usually wait.',
            other_or_unclear: 'None of the other categories clearly fits, or the excerpt lacks enough evidence.'
          }
        },
        needs_reply: {
          type: 'noul',
          instructions: 'Does `email` likely require a direct reply from the recipient?'
        },
        time_sensitive: {
          type: 'noul',
          instructions: 'Does `email` contain an explicit or strongly implied deadline, urgency, or time-sensitive request?'
        },
        priority: {
          type: 'score',
          instructions: 'How much attention should the recipient give `email` relative to ordinary inbox mail?',
          criteria: [
            'Low: routine or optional content that can safely wait.',
            'Normal: relevant content worth reading in the normal course of work.',
            'High: important, urgent, consequential, or clearly action-oriented content.'
          ]
        }
      }
    };

    const data = await this.postSystemOne(requestBody, apiKey);
    return this.normalizeAnalysis(data);
  }

  async testConnection(apiKey) {
    const normalizedKey = String(apiKey || '').trim();
    if (!normalizedKey) {
      throw new Error('Please fill in the JEV API Key.');
    }

    const data = await this.postSystemOne({
      model: this.model,
      state: 'InboxAI JEV connection test.',
      questions: {
        connection: {
          type: 'noul',
          instructions: 'Is this text explicitly a connection test?'
        }
      }
    }, normalizedKey);

    if (!data.answers || !data.answers.connection || !Number.isFinite(data.answers.connection.noul)) {
      throw new Error('JEV returned an invalid response.');
    }

    return true;
  }

  async postSystemOne(requestBody, apiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(this.httpErrorMessage(response.status));
      }

      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error('JEV returned invalid JSON.');
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('JEV request timed out.');
      }
      if (err instanceof TypeError) {
        throw new Error('Could not reach JEV.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  httpErrorMessage(status) {
    if (status === 401 || status === 403) {
      return 'JEV authentication failed. Check the JEV API Key in settings.';
    }
    if (status === 429 || status === 529) {
      return 'JEV is temporarily unavailable or rate limited.';
    }
    return `JEV API error (${status}).`;
  }

  normalizeAnalysis(data) {
    const answers = data && data.answers;
    const category = answers && answers.category;
    const needsReply = answers && answers.needs_reply;
    const timeSensitive = answers && answers.time_sensitive;
    const priority = answers && answers.priority;

    if (
      !category || typeof category.choice !== 'string' || !Number.isFinite(category.confidence) ||
      !needsReply || !Number.isFinite(needsReply.noul) ||
      !timeSensitive || !Number.isFinite(timeSensitive.noul) ||
      !priority || !Number.isFinite(priority.score) || !Number.isFinite(priority.confidence)
    ) {
      throw new Error('JEV returned an invalid response.');
    }

    return {
      category: category.choice,
      categoryConfidence: category.confidence,
      needsReplyProbability: needsReply.noul,
      timeSensitiveProbability: timeSensitive.noul,
      priorityScore: priority.score,
      priorityConfidence: priority.confidence
    };
  }
}

window.JevService = JevService;
