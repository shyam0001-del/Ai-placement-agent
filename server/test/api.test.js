import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { userService, formatProfileContext } from '../src/services/user/user.service.js';
import { memoryService } from '../src/services/memory/memory.service.js';
import { toolRegistry } from '../src/services/tools/index.js';
import { agentService } from '../src/services/agent/agent.service.js';
import { getDatabaseStatus } from '../src/config/db.js';

describe('AI Placement Agent - Full API & Agent Test Suite (Phase 1 + 2 + 3 + 4)', () => {
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
    memoryService.clearMemory();
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

  // ==========================================
  // PHASE 4 TESTS: MEMORY SYSTEM
  // ==========================================

  // 1. Create memory
  it('Phase 4.1: Create memory stores structured durable candidate fact', async () => {
    const memory = await memoryService.createOrUpdateMemory({
      userId: testUserId,
      type: 'goal',
      key: 'Primary Placement Target',
      value: 'Targeting Senior Data Analyst roles at high-growth tech companies',
      source: 'conversation',
      confidence: 0.95,
      importance: 0.9,
    });

    assert.ok(memory.id || memory._id);
    assert.strictEqual(memory.userId, testUserId);
    assert.strictEqual(memory.type, 'goal');
    assert.strictEqual(memory.key, 'Primary Placement Target');
    assert.strictEqual(memory.confidence, 0.95);
    assert.strictEqual(memory.importance, 0.9);
  });

  // 2. Retrieve memory
  it('Phase 4.2: Retrieve memory returns user memories with metadata', async () => {
    const memories = await memoryService.getMemoriesByUser(testUserId);
    assert.ok(Array.isArray(memories));
    assert.ok(memories.length >= 1);
    const target = memories.find((m) => m.key === 'Primary Placement Target');
    assert.ok(target);
    assert.strictEqual(target.type, 'goal');
  });

  // 3. Update memory
  it('Phase 4.3: Update memory modifies value, confidence, and importance', async () => {
    const memories = await memoryService.getMemoriesByUser(testUserId);
    const target = memories.find((m) => m.key === 'Primary Placement Target');
    assert.ok(target);

    const updated = await memoryService.updateMemory(target.id, {
      value: 'Targeting Lead Data Analyst and Analytics Engineer roles',
      confidence: 1.0,
      importance: 0.95,
    });

    assert.strictEqual(updated.value, 'Targeting Lead Data Analyst and Analytics Engineer roles');
    assert.strictEqual(updated.confidence, 1.0);
    assert.strictEqual(updated.importance, 0.95);
  });

  // 4. Delete memory
  it('Phase 4.4: Delete memory removes fact from persistence', async () => {
    const tempMem = await memoryService.createOrUpdateMemory({
      userId: testUserId,
      type: 'preference',
      key: 'Temporary Note',
      value: 'Prefers afternoon study sessions',
      confidence: 0.8,
      importance: 0.5,
    });

    const deleted = await memoryService.deleteMemory(tempMem.id);
    assert.strictEqual(deleted, true);

    const afterList = await memoryService.getMemoriesByUser(testUserId);
    assert.strictEqual(afterList.some((m) => m.key === 'Temporary Note'), false);
  });

  // 5. User isolation
  it('Phase 4.5: User isolation guarantees memories cannot be read across users', async () => {
    const userA = 'user_isolate_a_123';
    const userB = 'user_isolate_b_456';

    await memoryService.createOrUpdateMemory({
      userId: userA,
      type: 'weakness',
      key: 'Confidential Weakness',
      value: 'Struggles with recursion and trees',
      confidence: 0.9,
      importance: 0.8,
    });

    const userBMemories = await memoryService.getMemoriesByUser(userB);
    assert.strictEqual(userBMemories.length, 0);

    const userBRelevant = await memoryService.getRelevantMemories({
      userId: userB,
      query: 'recursion trees',
    });
    assert.strictEqual(userBRelevant.length, 0);
  });

  // 6. Invalid memory type
  it('Phase 4.6: Invalid memory type rejects with validation error', async () => {
    await assert.rejects(
      async () => {
        await memoryService.createOrUpdateMemory({
          userId: testUserId,
          type: 'uncontrolled_arbitrary_type',
          key: 'Random Key',
          value: 'Random value',
        });
      },
      (err) => {
        assert.ok(err.message.includes('Invalid memory type'));
        return true;
      }
    );
  });

  // 7. Invalid confidence
  it('Phase 4.7: Invalid confidence (<0 or >1) rejects with validation error', async () => {
    await assert.rejects(
      async () => {
        await memoryService.createOrUpdateMemory({
          userId: testUserId,
          type: 'weakness',
          key: 'Invalid Confidence Key',
          value: 'Some value',
          confidence: 1.5, // Invalid > 1.0
        });
      },
      (err) => {
        assert.ok(err.message.includes('Confidence must be between 0.0 and 1.0'));
        return true;
      }
    );
  });

  // 8. Duplicate memory handling
  it('Phase 4.8: Duplicate memory handling updates existing fact instead of inserting duplicate', async () => {
    await memoryService.createOrUpdateMemory({
      userId: testUserId,
      type: 'weakness',
      key: 'SQL Window Functions',
      value: 'User struggles with basic OVER clause',
      confidence: 0.7,
      importance: 0.7,
    });

    // Update the same fact
    const updated = await memoryService.createOrUpdateMemory({
      userId: testUserId,
      type: 'weakness',
      key: 'SQL Window Functions',
      value: 'User struggles with complex window functions like DENSE_RANK and LAG',
      confidence: 0.95,
      importance: 0.9,
    });

    const userMemories = await memoryService.getMemoriesByUser(testUserId);
    const windowMemories = userMemories.filter((m) => m.key === 'SQL Window Functions');

    assert.strictEqual(windowMemories.length, 1);
    assert.strictEqual(updated.confidence, 0.95);
    assert.strictEqual(updated.importance, 0.9);
    assert.ok(updated.value.includes('DENSE_RANK and LAG'));
  });

  // 9. Relevant memory retrieval
  it('Phase 4.9: Relevant memory retrieval filters by keyword and importance', async () => {
    // Add distinct memories
    await memoryService.createOrUpdateMemory({
      userId: testUserId,
      type: 'weakness',
      key: 'SQL Query Optimization',
      value: 'Frequently misses index scans and EXPLAIN plans',
      confidence: 0.9,
      importance: 0.85,
    });
    await memoryService.createOrUpdateMemory({
      userId: testUserId,
      type: 'preference',
      key: 'IDE Dark Mode',
      value: 'User prefers dark theme in code editors',
      confidence: 0.9,
      importance: 0.3,
    });

    const relevant = await memoryService.getRelevantMemories({
      userId: testUserId,
      query: 'What should I practice in SQL today?',
    });

    assert.ok(relevant.length >= 1);
    const sqlMem = relevant.find((m) => m.key.includes('SQL'));
    assert.ok(sqlMem);
    assert.strictEqual(relevant.some((m) => m.key === 'IDE Dark Mode'), false);
  });

  // 10. Irrelevant memory exclusion
  it('Phase 4.10: Irrelevant memory exclusion keeps unrelated facts out of context', async () => {
    const relevant = await memoryService.getRelevantMemories({
      userId: testUserId,
      query: 'Prepare for Kubernetes networking and ingress controllers',
    });

    assert.strictEqual(relevant.some((m) => m.key === 'IDE Dark Mode'), false);
    assert.strictEqual(relevant.some((m) => m.key === 'SQL Window Functions'), false);
  });

  // 11. Agent retrieving memory
  it('Phase 4.11: Agent retrieving memory calls get_relevant_memories tool and uses it in response', async () => {
    const originalGenerate = aiService.generateChatResponse;
    let toolCallReceived = null;

    // Step 1: Agent decides it needs to query memories
    let step = 0;
    aiService.generateChatResponse = async () => {
      step++;
      if (step === 1) {
        return {
          message: '',
          rawMessage: { role: 'assistant', content: null },
          toolCalls: [
            {
              id: 'call_mem_retrieval_1',
              type: 'function',
              function: {
                name: 'get_relevant_memories',
                arguments: JSON.stringify({ userId: testUserId, query: 'SQL weaknesses' }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      return {
        message: 'Based on your known weakness in SQL Window Functions, I recommend practicing 5 LEAD/LAG problems today.',
        rawMessage: { role: 'assistant', content: 'Based on your known weakness in SQL Window Functions, I recommend practicing 5 LEAD/LAG problems today.' },
        toolCalls: [],
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const result = await agentService.run({
        message: 'What should I study for my upcoming SQL interview?',
        userId: testUserId,
      });

      assert.strictEqual(result.toolCalls.length, 1);
      assert.strictEqual(result.toolCalls[0].name, 'get_relevant_memories');
      assert.strictEqual(result.toolCalls[0].status, 'success');
      assert.ok(result.message.includes('SQL Window Functions'));
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 12. Agent saving memory
  it('Phase 4.12: Agent saving memory calls save_memory tool for durable facts', async () => {
    const originalGenerate = aiService.generateChatResponse;

    let step = 0;
    aiService.generateChatResponse = async () => {
      step++;
      if (step === 1) {
        return {
          message: '',
          rawMessage: { role: 'assistant', content: null },
          toolCalls: [
            {
              id: 'call_mem_save_1',
              type: 'function',
              function: {
                name: 'save_memory',
                arguments: JSON.stringify({
                  userId: testUserId,
                  type: 'weakness',
                  key: 'Graph Traversal Algorithms',
                  value: 'Candidate frequently gets stuck on cycle detection in directed graphs (Tarjan/Kahn)',
                  confidence: 0.9,
                  importance: 0.85,
                }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      return {
        message: 'I have noted that Graph Traversal is a key area to reinforce. Let us tackle Kahn algorithm first.',
        rawMessage: { role: 'assistant', content: 'I have noted that Graph Traversal is a key area to reinforce.' },
        toolCalls: [],
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const result = await agentService.run({
        message: 'I keep failing graph traversal and cycle detection problems.',
        userId: testUserId,
      });

      assert.strictEqual(result.toolCalls.length, 1);
      assert.strictEqual(result.toolCalls[0].name, 'save_memory');
      assert.strictEqual(result.toolCalls[0].status, 'success');

      // Verify persistence in memoryService
      const memories = await memoryService.getMemoriesByUser(testUserId);
      const graphMem = memories.find((m) => m.key === 'Graph Traversal Algorithms');
      assert.ok(graphMem);
      assert.strictEqual(graphMem.type, 'weakness');
      assert.strictEqual(graphMem.confidence, 0.9);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 13. Agent updating memory
  it('Phase 4.13: Agent updating memory calls update_memory tool and persists updates', async () => {
    const originalGenerate = aiService.generateChatResponse;

    const memories = await memoryService.getMemoriesByUser(testUserId);
    const graphMem = memories.find((m) => m.key === 'Graph Traversal Algorithms');
    assert.ok(graphMem);

    let step = 0;
    aiService.generateChatResponse = async () => {
      step++;
      if (step === 1) {
        return {
          message: '',
          rawMessage: { role: 'assistant', content: null },
          toolCalls: [
            {
              id: 'call_mem_update_1',
              type: 'function',
              function: {
                name: 'update_memory',
                arguments: JSON.stringify({
                  memoryId: graphMem.id,
                  value: 'Candidate has improved on topological sort but still needs practice with Tarjan strongly connected components',
                  confidence: 0.95,
                  importance: 0.8,
                }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      return {
        message: 'Updated your progress on graph traversal!',
        rawMessage: { role: 'assistant', content: 'Updated your progress on graph traversal!' },
        toolCalls: [],
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const result = await agentService.run({
        message: 'I mastered Kahn topological sort! Still working on Tarjan SCC though.',
        userId: testUserId,
      });

      assert.strictEqual(result.toolCalls.length, 1);
      assert.strictEqual(result.toolCalls[0].name, 'update_memory');
      assert.strictEqual(result.toolCalls[0].status, 'success');

      const updated = await memoryService.getMemoriesByUser(testUserId);
      const updatedMem = updated.find((m) => m.id === graphMem.id);
      assert.ok(updatedMem.value.includes('Tarjan strongly connected components'));
      assert.strictEqual(updatedMem.confidence, 0.95);
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 14. REST API development endpoints (GET, POST, PATCH, DELETE)
  it('Phase 4.14: REST API development endpoints (GET, POST, PATCH, DELETE) function properly', async () => {
    // POST /api/users/:userId/memories
    const postRes = await fetch(`http://localhost:${TEST_PORT}/api/users/${testUserId}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'achievement',
        key: 'LeetCode 100 Solved',
        value: 'Solved 100 LeetCode problems including 60 medium problems',
        confidence: 1.0,
        importance: 0.8,
      }),
    });
    assert.strictEqual(postRes.status, 201);
    const postData = await postRes.json();
    assert.strictEqual(postData.success, true);
    const createdId = postData.data.id;
    assert.ok(createdId);

    // GET /api/users/:userId/memories
    const getRes = await fetch(`http://localhost:${TEST_PORT}/api/users/${testUserId}/memories`);
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.strictEqual(getData.success, true);
    assert.ok(getData.data.some((m) => m.id === createdId));

    // PATCH /api/memories/:memoryId
    const patchRes = await fetch(`http://localhost:${TEST_PORT}/api/memories/${createdId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: 'Solved 150 LeetCode problems including 90 medium problems',
        importance: 0.9,
      }),
    });
    assert.strictEqual(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.strictEqual(patchData.success, true);
    assert.strictEqual(patchData.data.value, 'Solved 150 LeetCode problems including 90 medium problems');

    // DELETE /api/memories/:memoryId
    const delRes = await fetch(`http://localhost:${TEST_PORT}/api/memories/${createdId}`, {
      method: 'DELETE',
    });
    assert.strictEqual(delRes.status, 200);
    const delData = await delRes.json();
    assert.strictEqual(delData.success, true);

    // Verify deleted
    const verifyGet = await fetch(`http://localhost:${TEST_PORT}/api/users/${testUserId}/memories`);
    const verifyData = await verifyGet.json();
    assert.strictEqual(verifyData.data.some((m) => m.id === createdId), false);
  });
});

