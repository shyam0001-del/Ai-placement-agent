import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { userService, formatProfileContext } from '../src/services/user/user.service.js';
import { getDatabaseStatus } from '../src/config/db.js';

describe('AI Placement Agent - Full API Test Suite (Phase 1 + Phase 2)', () => {
  let server;
  const TEST_PORT = 5097;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, resolve);
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
    userService.clearMemory();
  });

  // ==========================================
  // PHASE 1 REGRESSION TESTS (Section 9.10)
  // ==========================================

  it('Phase 1.1: Normal AI message returns 200 with structured response', async () => {
    const originalGenerate = aiService.generateChatResponse;
    aiService.generateChatResponse = async (input) => {
      assert.strictEqual(input, 'What should I study for a data analyst interview?');
      return {
        message: 'Master SQL (joins, window functions), Python pandas, and basic statistics.',
        model: 'configured-test-model',
        usage: { prompt_tokens: 12, completion_tokens: 24, total_tokens: 36 },
      };
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'What should I study for a data analyst interview?' }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.message.includes('Master SQL'));
      assert.strictEqual(json.data.model, 'configured-test-model');
      assert.strictEqual(json.message, json.data.message);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  it('Phase 1.2: Empty message rejects with 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '     ' }),
    });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  it('Phase 1.3: LLM API failure returns clean 502 without leaking secrets or stack trace', async () => {
    const originalGenerate = aiService.generateChatResponse;
    aiService.generateChatResponse = async () => {
      const err = new Error('Upstream provider timed out');
      err.code = 'AI_SERVICE_ERROR';
      err.statusCode = 502;
      throw err;
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test failure handling' }),
      });

      assert.strictEqual(res.status, 502);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'AI_SERVICE_ERROR');
      assert.strictEqual(json.error.stack, undefined);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  it('Phase 1.4: Missing API key returns clean 500 CONFIG_MISSING error', async () => {
    const originalGenerate = aiService.generateChatResponse;
    aiService.generateChatResponse = async () => {
      const err = new Error('AI configuration missing: OPENAI_API_KEY. Please configure your .env file.');
      err.code = 'CONFIG_MISSING';
      err.statusCode = 500;
      throw err;
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello AI' }),
      });

      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'CONFIG_MISSING');
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  it('Phase 1.5: Invalid request payload returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 9999 }),
    });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  // ==========================================
  // PHASE 2 SPECIFIC TESTS (Section 9)
  // ==========================================

  // 1. MongoDB connection handling
  it('Phase 2.1: MongoDB connection status reports correctly in health check', async () => {
    const status = getDatabaseStatus();
    assert.ok(typeof status.status === 'string');
    assert.ok(typeof status.connected === 'boolean');

    const res = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.database !== undefined);
    assert.ok(typeof json.data.database.status === 'string');
  });

  let createdUserId = '';

  // 2. Create user
  it('Phase 2.2: Create user (POST /api/users) creates a profile with 201', async () => {
    const payload = {
      name: 'Alex Rivera',
      email: 'alex.rivera@example.com',
      degree: 'B.Tech Computer Science',
      specialization: 'Artificial Intelligence',
      skills: [
        { name: 'Python', level: 'advanced' },
        { name: 'SQL', level: 'intermediate' },
        { name: 'Data Structures', level: 'intermediate' },
      ],
      targetRole: 'Data Scientist',
      targetCompanies: ['Google', 'Stripe', 'Amazon'],
      experienceLevel: 'Final Year Student',
      leetcodeSolved: 145,
      weakAreas: ['Dynamic Programming', 'System Design'],
    };

    const res = await fetch(`http://localhost:${TEST_PORT}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.name, 'Alex Rivera');
    assert.strictEqual(json.data.email, 'alex.rivera@example.com');
    assert.strictEqual(json.data.targetRole, 'Data Scientist');
    assert.strictEqual(json.data.skills.length, 3);
    assert.ok(json.data.id);
    createdUserId = json.data.id;
  });

  // 3. Get user
  it('Phase 2.3: Get user (GET /api/users/:id) returns profile by ID', async () => {
    assert.ok(createdUserId);
    const res = await fetch(`http://localhost:${TEST_PORT}/api/users/${createdUserId}`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, createdUserId);
    assert.strictEqual(json.data.name, 'Alex Rivera');
    assert.strictEqual(json.data.targetRole, 'Data Scientist');
  });

  // 4. Update user
  it('Phase 2.4: Update user (PATCH /api/users/:id) modifies profile fields', async () => {
    assert.ok(createdUserId);
    const updatePayload = {
      targetRole: 'Senior Data Scientist',
      leetcodeSolved: 180,
    };

    const res = await fetch(`http://localhost:${TEST_PORT}/api/users/${createdUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.targetRole, 'Senior Data Scientist');
    assert.strictEqual(json.data.leetcodeSolved, 180);
  });

  // 5. Invalid user payload
  it('Phase 2.5: Invalid user payload rejects with 400 VALIDATION_ERROR', async () => {
    // Missing email
    const res1 = await fetch(`http://localhost:${TEST_PORT}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam' }),
    });
    assert.strictEqual(res1.status, 400);
    const json1 = await res1.json();
    assert.strictEqual(json1.error.code, 'VALIDATION_ERROR');

    // Missing name
    const res2 = await fetch(`http://localhost:${TEST_PORT}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'valid@example.com' }),
    });
    assert.strictEqual(res2.status, 400);

    // Invalid email format
    const res3 = await fetch(`http://localhost:${TEST_PORT}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam', email: 'not-an-email' }),
    });
    assert.strictEqual(res3.status, 400);
  });

  // 6. Nonexistent user
  it('Phase 2.6: Nonexistent user (GET /api/users/unknown) returns 404 USER_NOT_FOUND', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/users/nonexistent_id_999`);
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'USER_NOT_FOUND');
  });

  // 7. Chat without userId (Backward compatibility)
  it('Phase 2.7: Chat without userId continues working seamlessly', async () => {
    const originalGenerate = aiService.generateChatResponse;
    let receivedOptions = null;

    aiService.generateChatResponse = async (input, options) => {
      receivedOptions = options;
      return {
        message: 'General placement advice without profile context.',
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'What is quicksort?' }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(receivedOptions.profileContext, undefined);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 8. Chat with valid userId (Profile context reaches AI service)
  it('Phase 2.8: Chat with valid userId retrieves profile and formats clean context for AI service', async () => {
    assert.ok(createdUserId);
    const originalGenerate = aiService.generateChatResponse;
    let receivedOptions = null;

    aiService.generateChatResponse = async (input, options) => {
      receivedOptions = options;
      return {
        message: 'Tailored answer for Alex Rivera preparing for Senior Data Scientist role.',
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: createdUserId,
          message: 'What areas should I focus on next?',
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(receivedOptions.profileContext);
      assert.ok(receivedOptions.profileContext.includes('Alex Rivera'));
      assert.ok(receivedOptions.profileContext.includes('Senior Data Scientist'));
      assert.ok(receivedOptions.profileContext.includes('Dynamic Programming'));
      // Verify raw database internals are NOT leaked in context
      assert.strictEqual(receivedOptions.profileContext.includes('_id'), false);
      assert.strictEqual(receivedOptions.profileContext.includes('__v'), false);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 9. Chat with nonexistent userId
  it('Phase 2.9: Chat with nonexistent userId returns 404 USER_NOT_FOUND', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'nonexistent-user-12345',
        message: 'Hello',
      }),
    });

    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'USER_NOT_FOUND');
  });

  // Helper unit test: formatProfileContext isolation
  it('Phase 2.10: formatProfileContext formats concise readable summary without raw internals', () => {
    const mockUser = {
      name: 'Priya Sharma',
      degree: 'B.E.',
      specialization: 'Information Technology',
      experienceLevel: 'Fresher',
      targetRole: 'Software Engineer - Backend',
      targetCompanies: ['Microsoft', 'Uber'],
      skills: [
        { name: 'Java', level: 'advanced' },
        { name: 'Spring Boot', level: 'intermediate' },
      ],
      weakAreas: ['Concurrency', 'Redis Caching'],
      leetcodeSolved: 220,
    };

    const formatted = formatProfileContext(mockUser);
    assert.ok(formatted.includes('Candidate Profile Context:'));
    assert.ok(formatted.includes('Priya Sharma'));
    assert.ok(formatted.includes('Java (advanced)'));
    assert.ok(formatted.includes('Software Engineer - Backend'));
    assert.ok(formatted.includes('Microsoft, Uber'));
    assert.ok(formatted.includes('Concurrency, Redis Caching'));
  });
});
