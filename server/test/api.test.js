import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { userService, formatProfileContext } from '../src/services/user/user.service.js';
import { toolRegistry } from '../src/services/tools/index.js';
import { agentService } from '../src/services/agent/agent.service.js';
import { getDatabaseStatus } from '../src/config/db.js';

describe('AI Placement Agent - Full API & Agent Test Suite (Phase 1 + 2 + 3)', () => {
  let server;
  const TEST_PORT = 5096;
  let testUserId = '';

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, resolve);
    });

    // Create a base candidate for Phase 2 and Phase 3 tests
    const user = await userService.createUser({
      name: 'Rohan Mehra',
      email: 'rohan.mehra@example.com',
      degree: 'B.Tech Information Technology',
      specialization: 'Cloud & Distributed Computing',
      skills: [
        { name: 'Python', level: 'advanced' },
        { name: 'SQL', level: 'intermediate' },
        { name: 'Docker', level: 'intermediate' },
      ],
      targetRole: 'DevOps / Backend SDE',
      targetCompanies: ['Uber', 'Salesforce'],
      experienceLevel: 'Final Year Student',
      leetcodeSolved: 160,
      weakAreas: ['Kubernetes Networking', 'Dynamic Programming'],
      progress: [
        { topic: 'SQL joins', status: 'completed', notes: 'Mastered inner/outer joins' },
        { topic: 'Dynamic Programming', status: 'weak', notes: 'Need more practice on knapsack' },
      ],
    });
    testUserId = user.id;
  });

  after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
    });
    userService.clearMemory();
  });

  // ==========================================
  // PHASE 1 REGRESSION TESTS (Section 11.10)
  // ==========================================

  it('Phase 1.1: Normal AI message returns 200 with structured response', async () => {
    const originalGenerate = aiService.generateChatResponse;
    aiService.generateChatResponse = async () => ({
      message: 'Master SQL (joins, window functions), Python pandas, and basic statistics.',
      model: 'test-llm',
      usage: null,
    });

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
  // PHASE 2 REGRESSION TESTS (Section 11.11)
  // ==========================================

  it('Phase 2.1: MongoDB connection status reports correctly in health check', async () => {
    const status = getDatabaseStatus();
    assert.ok(typeof status.status === 'string');

    const res = await fetch(`http://localhost:${TEST_PORT}/api/health`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.database !== undefined);
  });

  it('Phase 2.2: User CRUD operations succeed', async () => {
    // Get user
    const resGet = await fetch(`http://localhost:${TEST_PORT}/api/users/${testUserId}`);
    assert.strictEqual(resGet.status, 200);
    const userJson = await resGet.json();
    assert.strictEqual(userJson.data.name, 'Rohan Mehra');

    // Patch user
    const resPatch = await fetch(`http://localhost:${TEST_PORT}/api/users/${testUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leetcodeSolved: 175 }),
    });
    assert.strictEqual(resPatch.status, 200);
    const patchJson = await resPatch.json();
    assert.strictEqual(patchJson.data.leetcodeSolved, 175);
  });

  it('Phase 2.3: Nonexistent user returns 404 USER_NOT_FOUND', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/users/nonexistent_id_999`);
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'USER_NOT_FOUND');
  });

  it('Phase 2.4: Chat with nonexistent userId returns 404 USER_NOT_FOUND', async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'unknown-id-8888', message: 'Hello' }),
    });
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'USER_NOT_FOUND');
  });

  it('Phase 2.5: formatProfileContext formats concise readable summary without raw internals', () => {
    const formatted = formatProfileContext({
      name: 'Rohan Mehra',
      degree: 'B.Tech IT',
      targetRole: 'DevOps / Backend SDE',
      skills: [{ name: 'Go', level: 'intermediate' }],
      targetCompanies: ['Uber'],
      weakAreas: ['Kubernetes Networking'],
      leetcodeSolved: 175,
    });
    assert.ok(formatted.includes('Rohan Mehra'));
    assert.ok(formatted.includes('DevOps / Backend SDE'));
    assert.strictEqual(formatted.includes('_id'), false);
    assert.strictEqual(formatted.includes('__v'), false);
  });

  // ==========================================
  // PHASE 3 AGENT & TOOL CALLING TESTS (Section 11)
  // ==========================================

  // 1. No-tool response
  it('Phase 3.1: No-tool response: user query that requires no tool returns direct answer with 0 tool calls', async () => {
    const originalGenerate = aiService.generateChatResponse;
    aiService.generateChatResponse = async () => ({
      message: 'Hello! I am your AI Placement Agent. How can I assist your interview prep today?',
      toolCalls: null,
      model: 'test-model',
      usage: null,
    });

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.message.includes('Hello! I am your AI Placement Agent'));
      assert.strictEqual(json.data.toolCalls.length, 0);
      assert.strictEqual(json.data.iterations, 1);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 2. get_user_profile tool call
  it('Phase 3.2: get_user_profile tool call: agent executes tool and returns candidate profile', async () => {
    const originalGenerate = aiService.generateChatResponse;
    let turn = 0;

    aiService.generateChatResponse = async () => {
      turn++;
      if (turn === 1) {
        // Model requests get_user_profile
        return {
          message: '',
          rawMessage: { role: 'assistant', content: null },
          toolCalls: [
            {
              id: 'call_profile_1',
              type: 'function',
              function: {
                name: 'get_user_profile',
                arguments: JSON.stringify({ userId: testUserId }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      // Turn 2: Model formulates answer based on tool result
      return {
        message: 'According to your profile, you have Python (advanced), SQL (intermediate), and Docker (intermediate).',
        toolCalls: null,
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          message: 'What skills do I have in my profile?',
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.message.includes('Python (advanced)'));
      assert.strictEqual(json.data.toolCalls.length, 1);
      assert.strictEqual(json.data.toolCalls[0].name, 'get_user_profile');
      assert.strictEqual(json.data.toolCalls[0].success, true);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 3. get_user_progress tool call
  it('Phase 3.3: get_user_progress tool call: agent executes tool and reports weak topics', async () => {
    const originalGenerate = aiService.generateChatResponse;
    let turn = 0;

    aiService.generateChatResponse = async () => {
      turn++;
      if (turn === 1) {
        return {
          message: '',
          rawMessage: { role: 'assistant', content: null },
          toolCalls: [
            {
              id: 'call_progress_1',
              type: 'function',
              function: {
                name: 'get_user_progress',
                arguments: JSON.stringify({ userId: testUserId }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      return {
        message: 'Your current weak areas needing focus are: Kubernetes Networking and Dynamic Programming.',
        toolCalls: null,
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          message: 'What are my weak areas?',
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.message.includes('Kubernetes Networking'));
      assert.strictEqual(json.data.toolCalls.length, 1);
      assert.strictEqual(json.data.toolCalls[0].name, 'get_user_progress');
      assert.strictEqual(json.data.toolCalls[0].success, true);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 4. update_user_progress tool call
  it('Phase 3.4: update_user_progress tool call: updates progress and confirms in response', async () => {
    const originalGenerate = aiService.generateChatResponse;
    let turn = 0;

    aiService.generateChatResponse = async () => {
      turn++;
      if (turn === 1) {
        return {
          message: '',
          rawMessage: { role: 'assistant', content: null },
          toolCalls: [
            {
              id: 'call_update_1',
              type: 'function',
              function: {
                name: 'update_user_progress',
                arguments: JSON.stringify({
                  userId: testUserId,
                  topic: 'Binary Search',
                  status: 'completed',
                  notes: 'Solved 5 medium problems on LeetCode',
                }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      return {
        message: 'Great job! I have updated your preparation progress: "Binary Search" is now marked as completed.',
        toolCalls: null,
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          message: 'I completed Binary Search practice today with 5 LeetCode problems.',
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(json.data.message.includes('Binary Search'));
      assert.strictEqual(json.data.toolCalls.length, 1);
      assert.strictEqual(json.data.toolCalls[0].name, 'update_user_progress');
      assert.strictEqual(json.data.toolCalls[0].success, true);

      // Verify persistence in UserService
      const progress = await userService.getUserProgress(testUserId);
      assert.ok(progress.completedTopics.includes('Binary Search'));
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 5. Invalid tool arguments
  it('Phase 3.5: Invalid tool arguments: tool registry catches error cleanly without unhandled crash', async () => {
    // Missing required fields
    const res = await toolRegistry.executeTool('update_user_progress', { userId: testUserId });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.code, 'TOOL_EXECUTION_ERROR');
    assert.ok(res.error.message.includes('topic'));

    // Non-existent tool
    const resUnknown = await toolRegistry.executeTool('unknown_tool', {});
    assert.strictEqual(resUnknown.success, false);
    assert.strictEqual(resUnknown.error.code, 'TOOL_NOT_FOUND');
  });

  // 6. Tool execution failure
  it('Phase 3.6: Tool execution failure: structured error fed back to agent, agent explains gracefully', async () => {
    const originalGenerate = aiService.generateChatResponse;
    let turn = 0;
    let toolResultReceived = null;

    aiService.generateChatResponse = async (messages) => {
      turn++;
      if (turn === 1) {
        return {
          message: '',
          rawMessage: { role: 'assistant', content: null },
          toolCalls: [
            {
              id: 'call_fail_1',
              type: 'function',
              function: {
                name: 'get_user_progress',
                arguments: JSON.stringify({ userId: 'nonexistent-uuid' }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      // Inspect tool message received by model in turn 2
      const toolMsg = messages.find((m) => m.role === 'tool');
      if (toolMsg) {
        toolResultReceived = JSON.parse(toolMsg.content);
      }
      return {
        message: 'I was unable to retrieve your progress because the specified candidate record was not found.',
        toolCalls: null,
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          message: 'Check my progress please',
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.toolCalls[0].success, false);
      assert.ok(toolResultReceived);
      assert.strictEqual(toolResultReceived.success, false);
      assert.strictEqual(toolResultReceived.error.code, 'TOOL_EXECUTION_ERROR');
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 7. Multiple tool calls
  it('Phase 3.7: Multiple tool calls: executes both tools across loop iterations and synthesizes answer', async () => {
    const originalGenerate = aiService.generateChatResponse;
    let turn = 0;

    aiService.generateChatResponse = async () => {
      turn++;
      if (turn === 1) {
        // Turn 1: model asks for profile
        return {
          message: '',
          rawMessage: { role: 'assistant', content: null },
          toolCalls: [
            {
              id: 'call_multi_1',
              type: 'function',
              function: {
                name: 'get_user_profile',
                arguments: JSON.stringify({ userId: testUserId }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      if (turn === 2) {
        // Turn 2: model asks for progress
        return {
          message: '',
          rawMessage: { role: 'assistant', content: null },
          toolCalls: [
            {
              id: 'call_multi_2',
              type: 'function',
              function: {
                name: 'get_user_progress',
                arguments: JSON.stringify({ userId: testUserId }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      // Turn 3: synthesized final answer
      return {
        message: 'Synthesizing: You are preparing for DevOps with Python/Docker, and your weak area to target next is Kubernetes Networking.',
        toolCalls: null,
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          message: 'Review my profile and progress together.',
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.toolCalls.length, 2);
      assert.strictEqual(json.data.toolCalls[0].name, 'get_user_profile');
      assert.strictEqual(json.data.toolCalls[1].name, 'get_user_progress');
      assert.strictEqual(json.data.iterations, 3);
      assert.ok(json.data.message.includes('Kubernetes Networking'));
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 8. Maximum iteration protection
  it('Phase 3.8: Maximum iteration protection: stops loop cleanly when max iterations reached without infinite loop', async () => {
    const originalGenerate = aiService.generateChatResponse;

    // AI model repeatedly generates tool calls forever
    aiService.generateChatResponse = async () => ({
      message: '',
      rawMessage: { role: 'assistant', content: null },
      toolCalls: [
        {
          id: `loop_call_${Math.random()}`,
          type: 'function',
          function: {
            name: 'get_user_profile',
            arguments: JSON.stringify({ userId: testUserId }),
          },
        },
      ],
      model: 'test-model',
      usage: null,
    });

    try {
      const result = await agentService.run({
        message: 'Infinite tool call request',
        userId: testUserId,
        options: { maxIterations: 3 },
      });

      assert.strictEqual(result.iterations, 3);
      assert.strictEqual(result.maxIterationsReached, true);
      assert.ok(result.message);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 9. Tool timeout
  it('Phase 3.9: Tool timeout: agent execution exceeding timeout throws AGENT_TIMEOUT error', async () => {
    const originalGenerate = aiService.generateChatResponse;

    aiService.generateChatResponse = async () => {
      // Simulate artificial delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        message: '',
        rawMessage: { role: 'assistant', content: null },
        toolCalls: [
          {
            id: 'timeout_call',
            type: 'function',
            function: {
              name: 'get_user_profile',
              arguments: JSON.stringify({ userId: testUserId }),
            },
          },
        ],
        model: 'test-model',
        usage: null,
      };
    };

    try {
      await agentService.run({
        message: 'Test timeout',
        userId: testUserId,
        options: { timeoutMs: 25 }, // 25ms timeout
      });
      assert.fail('Should have thrown timeout error');
    } catch (err) {
      assert.strictEqual(err.code, 'AGENT_TIMEOUT');
      assert.strictEqual(err.statusCode, 504);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });
});
