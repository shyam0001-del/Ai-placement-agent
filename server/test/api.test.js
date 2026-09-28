import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { aiService } from '../src/services/ai/ai.service.js';

describe('AI Placement Agent - Phase 1 Verification Tests', () => {
  let server;
  const TEST_PORT = 5098;

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

  // Test 1: Normal AI message
  it('1. Normal AI message returns 200 with structured response', async () => {
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

  // Test 2: Empty message
  it('2. Empty message rejects with 400 VALIDATION_ERROR', async () => {
    const res1 = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    assert.strictEqual(res1.status, 400);
    const json1 = await res1.json();
    assert.strictEqual(json1.success, false);
    assert.strictEqual(json1.error.code, 'VALIDATION_ERROR');

    // Also test whitespace-only message
    const res2 = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '     ' }),
    });
    assert.strictEqual(res2.status, 400);
    const json2 = await res2.json();
    assert.strictEqual(json2.success, false);
    assert.strictEqual(json2.error.code, 'VALIDATION_ERROR');
    assert.strictEqual(json2.error.message, 'Message cannot be blank.');
  });

  // Test 3: LLM API failure
  it('3. LLM API failure returns clean 502 without leaking secrets or stack trace', async () => {
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
      assert.strictEqual(json.error.message, 'Upstream provider timed out');
      // Verify no stack trace leaked
      assert.strictEqual(json.stack, undefined);
      assert.strictEqual(json.error.stack, undefined);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // Test 4: Missing API key
  it('4. Missing API key / configuration returns clean 500 CONFIG_MISSING error', async () => {
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
      assert.ok(json.error.message.includes('OPENAI_API_KEY'));
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // Test 5: Invalid request
  it('5. Invalid request (missing body, invalid types) returns 400 VALIDATION_ERROR', async () => {
    // Missing body
    const res1 = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res1.status, 400);
    const json1 = await res1.json();
    assert.strictEqual(json1.error.code, 'VALIDATION_ERROR');

    // Invalid non-string message (e.g. number)
    const res2 = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 12345 }),
    });
    assert.strictEqual(res2.status, 400);
    const json2 = await res2.json();
    assert.strictEqual(json2.error.code, 'VALIDATION_ERROR');
    assert.strictEqual(json2.error.message, '"message" field must be a valid non-empty string.');

    // Invalid non-string message (e.g. boolean)
    const res3 = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: true }),
    });
    assert.strictEqual(res3.status, 400);
  });

  // Test 6: Backend unavailable
  it('6. Backend unavailable (connection refused) is handled properly by fetch client', async () => {
    const UNUSED_PORT = 59999;
    try {
      await fetch(`http://localhost:${UNUSED_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      });
      assert.fail('Should have thrown connection error');
    } catch (err) {
      assert.ok(err instanceof TypeError || err.name === 'TypeError' || err.code === 'ECONNREFUSED');
    }
  });

  // Test 7: Multiple consecutive messages
  it('7. Multiple consecutive messages maintain conversation continuity correctly', async () => {
    const originalGenerate = aiService.generateChatResponse;
    const receivedPayloads = [];

    aiService.generateChatResponse = async (input) => {
      receivedPayloads.push(input);
      if (receivedPayloads.length === 1) {
        return {
          message: 'I can help you prepare for a Data Scientist interview.',
          model: 'configured-test-model',
          usage: null,
        };
      }
      return {
        message: 'Let us start with Machine Learning fundamentals: bias-variance tradeoff.',
        model: 'configured-test-model',
        usage: null,
      };
    };

    try {
      // First turn
      const res1 = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'I want to prepare for Data Scientist' }),
      });
      assert.strictEqual(res1.status, 200);
      const json1 = await res1.json();
      assert.strictEqual(json1.success, true);

      // Second consecutive turn with history
      const history = [
        { role: 'user', content: 'I want to prepare for Data Scientist' },
        { role: 'assistant', content: json1.data.message },
      ];

      const res2 = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'What should we start with?',
          history,
        }),
      });

      assert.strictEqual(res2.status, 200);
      const json2 = await res2.json();
      assert.strictEqual(json2.success, true);
      assert.ok(json2.data.message.includes('Machine Learning fundamentals'));

      // Check that the history was correctly forwarded to AI service
      assert.strictEqual(receivedPayloads.length, 2);
      const secondPayload = receivedPayloads[1];
      assert.strictEqual(Array.isArray(secondPayload), true);
      assert.strictEqual(secondPayload.length, 3); // 2 history items + 1 new user message
      assert.strictEqual(secondPayload[2].content, 'What should we start with?');
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });
});
