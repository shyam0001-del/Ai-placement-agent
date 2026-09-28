/**
 * API service for communicating with the Node.js Express backend
 */

const API_BASE = '/api';

/**
 * Send a chat message to the backend
 * @param {string} message - User message
 * @param {Array<{role: string, content: string}>} [history] - Optional conversation history
 * @returns {Promise<{message: string, model?: string, usage?: Object}>}
 */
export async function sendChatMessage(message, history = []) {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
      const err = new Error(errorMsg);
      err.code = data?.error?.code || 'CHAT_ERROR';
      err.status = response.status;
      throw err;
    }

    return {
      message: data.data?.message || data.message || '',
      model: data.data?.model || 'configured model',
      usage: data.data?.usage || null,
    };
  } catch (error) {
    console.error('API service error [sendChatMessage]:', error);
    throw error;
  }
}

/**
 * Check backend server and AI service readiness
 * @returns {Promise<{status: string, configuredModel: string, aiReady: boolean, missingEnv?: string[]}>}
 */
export async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) {
      throw new Error(`Health check returned status ${response.status}`);
    }
    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.warn('Backend health check unreachable:', error.message);
    return {
      status: 'offline',
      configuredModel: 'Unknown',
      aiReady: false,
      error: error.message,
    };
  }
}
