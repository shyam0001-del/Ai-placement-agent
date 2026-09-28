import OpenAI from 'openai';
import { config, validateAiConfig } from '../../config/env.js';

class AiService {
  constructor() {
    this.client = null;
  }

  /**
   * Lazily initialize or retrieve the OpenAI client instance
   */
  getClient() {
    const { isValid, missing } = validateAiConfig();
    if (!isValid) {
      const err = new Error(
        `AI configuration missing: ${missing.join(', ')}. Please configure your .env file with OPENAI_API_KEY and OPENAI_MODEL.`
      );
      err.code = 'CONFIG_MISSING';
      err.statusCode = 500;
      throw err;
    }

    if (!this.client) {
      const clientOptions = {
        apiKey: config.openai.apiKey,
      };

      if (config.openai.baseURL) {
        clientOptions.baseURL = config.openai.baseURL;
      }

      this.client = new OpenAI(clientOptions);
    }

    return this.client;
  }

  /**
   * Send a chat message or messages array to the configured LLM
   * @param {string|Array<{role: string, content: string}>} input - user message string or history array
   * @param {Object} options - additional options (systemPrompt, temperature, etc.)
   * @returns {Promise<{message: string, model: string, usage: Object}>}
   */
  async generateChatResponse(input, options = {}) {
    const client = this.getClient();
    const model = config.openai.model;

    const defaultSystemPrompt =
      'You are the AI Placement Agent, an intelligent, empathetic, and rigorous placement and interview preparation assistant for engineering students and tech candidates. ' +
      'Your mission is to help candidates crack their target roles (Software Engineering, Data Science, Data Analyst, ML, DevOps, Product, etc.). ' +
      'Provide structured, clear, and actionable advice. When explaining technical concepts, use concise explanations, clear examples, and best-practice frameworks. ' +
      'Maintain an encouraging, highly professional tone.';

    let messages = [];

    if (Array.isArray(input)) {
      // If already a message array, ensure system prompt is present
      const hasSystem = input.some((m) => m.role === 'system');
      if (!hasSystem) {
        messages = [
          { role: 'system', content: options.systemPrompt || defaultSystemPrompt },
          ...input,
        ];
      } else {
        messages = input;
      }
    } else if (typeof input === 'string') {
      messages = [
        { role: 'system', content: options.systemPrompt || defaultSystemPrompt },
        { role: 'user', content: input },
      ];
    } else {
      const err = new Error('Invalid input: message must be a string or an array of messages');
      err.code = 'INVALID_INPUT';
      err.statusCode = 400;
      throw err;
    }

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      });

      const replyContent = response.choices?.[0]?.message?.content?.trim() || '';

      return {
        message: replyContent,
        model: response.model || model,
        usage: response.usage || null,
      };
    } catch (error) {
      console.error('LLM API error:', error?.message || error);

      let statusCode = 502;
      let code = 'AI_SERVICE_ERROR';
      let message = error?.message || 'Error communicating with AI service';

      if (typeof error?.status === 'number' && error.status >= 400 && error.status < 600) {
        statusCode = error.status;
      }

      if (error?.status === 401 || error?.code === 'invalid_api_key') {
        statusCode = 401;
        code = 'INVALID_API_KEY';
        message = 'Invalid API key provided. Please check OPENAI_API_KEY in your server/.env file.';
      } else if (error?.status === 404 || error?.code === 'model_not_found') {
        statusCode = 404;
        code = 'MODEL_NOT_FOUND';
        message = `The configured model "${model}" was not found or is not accessible with this API key.`;
      } else if (error?.status === 429) {
        statusCode = 429;
        code = 'RATE_LIMIT_EXCEEDED';
        message = 'AI rate limit exceeded or quota exhausted. Please check your provider account.';
      }

      const err = new Error(message);
      err.code = code;
      err.statusCode = statusCode;
      throw err;
    }
  }
}

// Export singleton instance
export const aiService = new AiService();
