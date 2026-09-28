import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { aiService } from '../src/services/ai/ai.service.js';

describe('AI Placement Agent - Phase 1 API Tests', () => {
  let server;
  const TEST_PORT = 5099;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, resolve);
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  it('GET /api/health returns 200 with service info', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, 'online');
    assert.strictEqual(json.data.service, 'AI Placement Agent Server');
  });

  it('POST /api/chat rejects missing message with 400', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  it('POST /api/chat rejects blank message with 400', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  it('GET /api/unknown returns 404 with NOT_FOUND code', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/nonexistent`);
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'NOT_FOUND');
  });

  it('POST /api/chat returns structured success response when AI service returns response', async () => {
    // Temporarily mock aiService.generateChatResponse to test end-to-end response handling
    const originalGenerate = aiService.generateChatResponse;
    aiService.generateChatResponse = async (input) => {
      return {
        message: 'For a Data Analyst interview, focus on SQL joins, window functions, and Pandas.',
        model: 'test-llm-model',
        usage: { prompt_tokens: 15, completion_tokens: 20, total_tokens: 35 },
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
      assert.ok(json.data.message.includes('Data Analyst'));
      assert.strictEqual(json.data.model, 'test-llm-model');
      assert.strictEqual(json.message, json.data.message); // Compatibility with Section 5 and Section 18
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });
});
