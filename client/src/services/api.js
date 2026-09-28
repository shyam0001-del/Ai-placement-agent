/**
 * API service for communicating with the Node.js Express backend
 */

const API_BASE = '/api';

/**
 * Send a chat message to the backend
 * @param {string} message - User message
 * @param {Array<{role: string, content: string}>} [history] - Optional conversation history
 * @param {string} [userId] - Optional active user profile ID (Phase 2)
 * @returns {Promise<{message: string, model?: string, usage?: Object}>}
 */
export async function sendChatMessage(message, history = [], userId = null) {
  try {
    const payload = {
      message,
      history,
    };

    if (userId && typeof userId === 'string' && userId.trim()) {
      payload.userId = userId.trim();
    }

    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok || !data?.success) {
      const errorMsg =
        data?.error?.message ||
        data?.message ||
        (response.status === 404
          ? 'API route or resource not found.'
          : response.status >= 500
          ? 'Backend service error. Please verify server logs.'
          : `Request failed with status ${response.status}`);
      const err = new Error(errorMsg);
      err.code = data?.error?.code || 'CHAT_ERROR';
      err.status = response.status;
      throw err;
    }

    return {
      message: data.data?.message || data.message || '',
      model: data.data?.model || 'configured model',
      usage: data.data?.usage || null,
      toolCalls: data.data?.toolCalls || [],
    };
  } catch (error) {
    if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('network'))) {
      const networkErr = new Error('Cannot connect to backend server. Ensure backend is running on port 5000.');
      networkErr.code = 'BACKEND_OFFLINE';
      throw networkErr;
    }
    console.error('API service error [sendChatMessage]:', error);
    throw error;
  }
}

/**
 * Check backend server and AI service readiness
 * @returns {Promise<{status: string, configuredModel: string, aiReady: boolean, database?: Object, missingEnv?: string[]}>}
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
      database: { status: 'offline', connected: false },
      error: error.message,
    };
  }
}

/**
 * ========================================================
 * User Profile API Methods (Phase 2)
 * ========================================================
 */

/**
 * Create a new user profile
 * @param {Object} profileData
 */
export async function createUserProfile(profileData) {
  const response = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const err = new Error(data?.error?.message || 'Failed to create user profile');
    err.code = data?.error?.code || 'USER_CREATE_ERROR';
    throw err;
  }
  return data.data;
}

/**
 * Retrieve user profile by ID
 * @param {string} id
 */
export async function getUserProfile(id) {
  const response = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const err = new Error(data?.error?.message || 'Failed to fetch user profile');
    err.code = data?.error?.code || 'USER_FETCH_ERROR';
    throw err;
  }
  return data.data;
}

/**
 * Update an existing user profile
 * @param {string} id
 * @param {Object} updateData
 */
export async function updateUserProfile(id, updateData) {
  const response = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const err = new Error(data?.error?.message || 'Failed to update user profile');
    err.code = data?.error?.code || 'USER_UPDATE_ERROR';
    throw err;
  }
  return data.data;
}

/**
 * Delete a user profile
 * @param {string} id
 */
export async function deleteUserProfile(id) {
  const response = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const err = new Error(data?.error?.message || 'Failed to delete user profile');
    err.code = data?.error?.code || 'USER_DELETE_ERROR';
    throw err;
  }
  return data.data;
}

/**
 * ========================================================
 * Memory API Methods (Phase 4)
 * Development-only endpoints until authentication exists
 * ========================================================
 */

/**
 * Fetch memories for a candidate
 * @param {string} userId
 */
export async function getUserMemories(userId) {
  if (!userId) return [];
  const response = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/memories`);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const err = new Error(data?.error?.message || 'Failed to fetch user memories');
    err.code = data?.error?.code || 'MEMORY_FETCH_ERROR';
    throw err;
  }
  return data.data || [];
}

/**
 * Delete a memory record
 * @param {string} memoryId
 */
export async function deleteUserMemory(memoryId) {
  if (!memoryId) return false;
  const response = await fetch(`${API_BASE}/memories/${encodeURIComponent(memoryId)}`, {
    method: 'DELETE',
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const err = new Error(data?.error?.message || 'Failed to delete memory');
    err.code = data?.error?.code || 'MEMORY_DELETE_ERROR';
    throw err;
  }
  return data.data;
}

/**
 * ========================================================
 * Placement Intelligence API Methods (Phase 5)
 * ========================================================
 */

/**
 * Fetch available placement roles from catalog
 */
export async function fetchPlacementRoles() {
  const response = await fetch(`${API_BASE}/placement/roles`);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const err = new Error(data?.error?.message || 'Failed to fetch placement roles');
    err.code = data?.error?.code || 'ROLES_FETCH_ERROR';
    throw err;
  }
  return data.data || [];
}

/**
 * Fetch role requirements for a specific target role
 * @param {string} role
 */
export async function fetchRoleRequirements(role) {
  if (!role) return null;
  const response = await fetch(`${API_BASE}/placement/roles/${encodeURIComponent(role)}`);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const err = new Error(data?.error?.message || 'Failed to fetch role requirements');
    err.code = data?.error?.code || 'ROLE_REQUIREMENTS_ERROR';
    throw err;
  }
  return data.data;
}

/**
 * Fetch deterministic placement intelligence analysis for active user
 * @param {string} userId
 * @param {string} [role]
 */
export async function fetchPlacementAnalysis(userId, role = null) {
  if (!userId) return null;
  const url = role
    ? `${API_BASE}/users/${encodeURIComponent(userId)}/placement-analysis?role=${encodeURIComponent(role)}`
    : `${API_BASE}/users/${encodeURIComponent(userId)}/placement-analysis`;

  const response = await fetch(url);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    const err = new Error(data?.error?.message || 'Failed to fetch placement analysis');
    err.code = data?.error?.code || 'PLACEMENT_ANALYSIS_ERROR';
    throw err;
  }
  return data.data;
}


