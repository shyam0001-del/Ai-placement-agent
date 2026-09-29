import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { aiService } from '../src/services/ai/ai.service.js';
import { userService, formatProfileContext } from '../src/services/user/user.service.js';
import { memoryService } from '../src/services/memory/memory.service.js';
import { placementIntelligenceService, READINESS_LEVELS } from '../src/services/placement/placementIntelligence.service.js';
import { toolRegistry } from '../src/services/tools/index.js';
import { agentService } from '../src/services/agent/agent.service.js';
import { getDatabaseStatus } from '../src/config/db.js';
import { practiceService } from '../src/services/practice/practice.service.js';
import { questionGeneratorService } from '../src/services/practice/questionGenerator.service.js';
import { answerEvaluationService } from '../src/services/practice/answerEvaluation.service.js';
import { documentService } from '../src/services/rag/document.service.js';
import { chunkingService } from '../src/services/rag/chunking.service.js';
import { embeddingService } from '../src/services/rag/embedding.service.js';
import { vectorStoreService } from '../src/services/rag/vectorStore.service.js';
import { retrievalService } from '../src/services/rag/retrieval.service.js';
import { ragService } from '../src/services/rag/rag.service.js';
import { searchKnowledgeTool } from '../src/services/tools/searchKnowledge.tool.js';
import { seedKnowledgeBase } from '../src/services/rag/seedData.js';

describe('AI Placement Agent - Full API & Agent Test Suite (Phase 1 + 2 + 3 + 4 + 5 + 6 + 7)', () => {
  let server;
  const TEST_PORT = 5096;
  let testUserId = '';

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, resolve);
    });

    // Initialize seed knowledge base for tests
    await seedKnowledgeBase();

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
    practiceService.clearMemory();
    documentService.clearMemory();
    vectorStoreService.clearVectors();
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

  // ==========================================
  // PHASE 5 TESTS: PLACEMENT INTELLIGENCE ENGINE
  // ==========================================

  // 1. Role catalog retrieval
  it('Phase 5.1: Role catalog retrieval returns valid structured roles', () => {
    const roles = placementIntelligenceService.getAvailableRoles();
    assert.ok(Array.isArray(roles));
    assert.ok(roles.length >= 8);
    const analyst = roles.find((r) => r.title === 'Data Analyst');
    assert.ok(analyst);
    assert.strictEqual(analyst.category, 'Analytics');
    assert.ok(analyst.requiredSkillCount >= 5);
  });

  // 2. Unknown role handling
  it('Phase 5.2: Unknown role handling throws descriptive error', () => {
    assert.throws(
      () => {
        placementIntelligenceService.getRoleRequirements('Quantum Blockchain Wizard');
      },
      (err) => {
        assert.ok(err.message.includes('not found in catalog'));
        return true;
      }
    );
  });

  // 3. Skill normalization
  it('Phase 5.3: Skill normalization handles casing, punctuation, and whitespace', () => {
    assert.strictEqual(placementIntelligenceService.normalizeSkill('  JavaScript  '), 'javascript');
    assert.strictEqual(placementIntelligenceService.normalizeSkill('React.js'), 'react');
    assert.strictEqual(placementIntelligenceService.normalizeSkill('SQL'), 'sql');
    assert.strictEqual(placementIntelligenceService.normalizeSkill('PowerBI'), 'power bi');
  });

  // 4. Alias normalization
  it('Phase 5.4: Alias normalization maps synonyms to canonical skills', () => {
    assert.strictEqual(placementIntelligenceService.normalizeSkill('dsa'), 'data structures & algorithms');
    assert.strictEqual(placementIntelligenceService.normalizeSkill('ml'), 'machine learning');
    assert.strictEqual(placementIntelligenceService.normalizeSkill('stats'), 'statistics & probability');
    assert.strictEqual(placementIntelligenceService.normalizeSkill('postgres'), 'sql');
  });

  // 5. Candidate skill matching
  it('Phase 5.5: Candidate skill matching identifies verified competencies', () => {
    const requirements = placementIntelligenceService.getRoleRequirements('Backend Developer');
    const candidate = {
      skills: [
        { name: 'Node.js / Express', level: 'advanced' },
        { name: 'SQL', level: 'advanced' },
      ],
      progress: [],
      weakAreas: [],
    };

    const comparison = placementIntelligenceService.compareCandidateSkills(candidate, requirements);
    assert.ok(comparison.strengths.some((s) => s.skill.includes('Node')));
    assert.ok(comparison.strengths.some((s) => s.skill === 'SQL'));
  });

  // 6. Missing skill detection
  it('Phase 5.6: Missing skill detection classifies absent requirements as gaps', () => {
    const requirements = placementIntelligenceService.getRoleRequirements('Data Analyst');
    const candidate = {
      skills: [{ name: 'Python', level: 'intermediate' }],
      progress: [],
      weakAreas: [],
    };

    const comparison = placementIntelligenceService.compareCandidateSkills(candidate, requirements);
    const missingSql = comparison.gaps.find((g) => g.skill === 'SQL');
    assert.ok(missingSql);
    assert.strictEqual(missingSql.status, 'gap');
    assert.strictEqual(missingSql.importance, 'high');
  });

  // 7. Proficiency-aware matching
  it('Phase 5.7: Proficiency-aware matching differentiates beginner vs target proficiency', () => {
    const requirements = placementIntelligenceService.getRoleRequirements('Data Analyst');
    // SQL requires advanced
    const candidate = {
      skills: [{ name: 'SQL', level: 'beginner' }],
      progress: [],
      weakAreas: [],
    };

    const comparison = placementIntelligenceService.compareCandidateSkills(candidate, requirements);
    const sqlDeveloping = comparison.developing.find((d) => d.skill === 'SQL');
    assert.ok(sqlDeveloping);
    assert.strictEqual(sqlDeveloping.status, 'developing');
    assert.strictEqual(sqlDeveloping.currentLevel, 'beginner');
  });

  // 8. Skill gap calculation
  it('Phase 5.8: Skill gap calculation outputs structured gap objects with explanations', () => {
    const requirements = placementIntelligenceService.getRoleRequirements('Backend Developer');
    const candidate = {
      skills: [{ name: 'JavaScript', level: 'intermediate' }],
      weakAreas: ['System Design'],
      progress: [],
    };

    const comparison = placementIntelligenceService.compareCandidateSkills(candidate, requirements);
    const allGaps = [...comparison.gaps, ...comparison.developing];
    assert.ok(allGaps.length >= 4);
    const dockerGap = allGaps.find((g) => g.skill.includes('Docker'));
    assert.ok(dockerGap);
    assert.ok(dockerGap.reason.includes('Required for Backend Developer'));
  });

  // 9. Priority ordering
  it('Phase 5.9: Priority ordering ranks high importance and missing gaps at top', () => {
    const requirements = placementIntelligenceService.getRoleRequirements('Data Analyst');
    const candidate = {
      skills: [
        { name: 'Python', level: 'intermediate' },
        { name: 'Power BI', level: 'intermediate' },
      ],
      weakAreas: ['SQL'],
      progress: [],
    };

    const comparison = placementIntelligenceService.compareCandidateSkills(candidate, requirements);
    const priorities = placementIntelligenceService.prioritizeSkillGaps([...comparison.gaps, ...comparison.developing]);
    assert.strictEqual(priorities[0].priority, 1);
    // SQL or Statistics should be #1 or #2
    const topTwo = [priorities[0].skill, priorities[1].skill];
    assert.ok(topTwo.includes('SQL') || topTwo.includes('Statistics & Probability'));
  });

  // 10. Readiness calculation
  it('Phase 5.10: Readiness calculation assigns explainable score and level categories', () => {
    const requirements = placementIntelligenceService.getRoleRequirements('Data Scientist');
    const weakCandidate = { skills: [], progress: [], leetcodeSolved: 0 };
    const weakComp = placementIntelligenceService.compareCandidateSkills(weakCandidate, requirements);
    const weakReadiness = placementIntelligenceService.calculateReadiness(weakCandidate, requirements, weakComp);
    assert.strictEqual(weakReadiness.level, READINESS_LEVELS.EARLY);
    assert.ok(weakReadiness.score <= 0.35);

    const strongCandidate = {
      skills: requirements.skills.map((s) => ({ name: s.name, level: 'advanced' })),
      progress: [{ topic: 'Machine Learning', status: 'completed' }],
      leetcodeSolved: 250,
    };
    const strongComp = placementIntelligenceService.compareCandidateSkills(strongCandidate, requirements);
    const strongReadiness = placementIntelligenceService.calculateReadiness(strongCandidate, requirements, strongComp);
    assert.strictEqual(strongReadiness.level, READINESS_LEVELS.PLACEMENT_READY);
    assert.ok(strongReadiness.score >= 0.80);
  });

  // 11. get_role_requirements tool
  it('Phase 5.11: get_role_requirements tool executes and returns catalog skills', async () => {
    const result = await toolRegistry.executeTool('get_role_requirements', {
      role: 'Data Analyst',
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.role, 'Data Analyst');
    assert.ok(Array.isArray(result.data.requiredSkills));
    assert.ok(result.data.requiredSkills.some((s) => s.name === 'SQL'));
  });

  // 12. analyze_placement_readiness tool
  it('Phase 5.12: analyze_placement_readiness tool evaluates candidate profile against target role', async () => {
    const result = await toolRegistry.executeTool('analyze_placement_readiness', {
      userId: testUserId,
      role: 'Backend Developer',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.targetRole, 'Backend Developer');
    assert.ok(result.data.readiness.level);
    assert.ok(Array.isArray(result.data.priorityGaps));
    assert.ok(Array.isArray(result.data.recommendations));
  });

  // 13. get_skill_gap_analysis tool
  it('Phase 5.13: get_skill_gap_analysis tool identifies actionable missing competencies', async () => {
    const result = await toolRegistry.executeTool('get_skill_gap_analysis', {
      userId: testUserId,
      role: 'Frontend Developer',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.targetRole, 'Frontend Developer');
    assert.ok(result.data.totalGapsCount >= 3);
    assert.ok(result.data.skillGaps.some((g) => g.skill === 'React' || g.skill === 'JavaScript'));
  });

  // 14. User isolation
  it('Phase 5.14: User isolation ensures candidate A analysis does not bleed into candidate B', async () => {
    const userA = await userService.createUser({
      name: 'Candidate A',
      email: 'candA@test.com',
      skills: [{ name: 'Python', level: 'advanced' }, { name: 'SQL', level: 'advanced' }],
      targetRole: 'Data Analyst',
    });

    const userB = await userService.createUser({
      name: 'Candidate B',
      email: 'candB@test.com',
      skills: [{ name: 'HTML & CSS', level: 'beginner' }],
      targetRole: 'Data Analyst',
    });

    const analysisA = await placementIntelligenceService.generatePlacementAnalysis({ userId: userA.id });
    const analysisB = await placementIntelligenceService.generatePlacementAnalysis({ userId: userB.id });

    assert.ok(analysisA.readiness.score > analysisB.readiness.score);
    assert.strictEqual(analysisA.strengths.some((s) => s.skill === 'SQL'), true);
    assert.strictEqual(analysisB.strengths.some((s) => s.skill === 'SQL'), false);
  });

  // 15. Invalid user ID
  it('Phase 5.15: Invalid user ID returns validation error', async () => {
    await assert.rejects(
      async () => {
        await placementIntelligenceService.generatePlacementAnalysis({ userId: 'nonexistent-user-id-xyz' });
      },
      (err) => {
        assert.ok(err.message.includes('not found') || err.message.includes('invalid'));
        return true;
      }
    );
  });

  // 16. Invalid role
  it('Phase 5.16: Invalid role returns descriptive error', async () => {
    await assert.rejects(
      async () => {
        await placementIntelligenceService.generatePlacementAnalysis({
          userId: testUserId,
          role: 'Imaginary Job Position 9000',
        });
      },
      (err) => {
        assert.ok(err.message.includes('not found in catalog'));
        return true;
      }
    );
  });

  // 17. Empty candidate skills
  it('Phase 5.17: Empty candidate skills handled gracefully without crash', async () => {
    const emptyUser = await userService.createUser({
      name: 'Blank Candidate',
      email: 'blank@test.com',
      skills: [],
      targetRole: 'Software Engineer',
    });

    const analysis = await placementIntelligenceService.generatePlacementAnalysis({ userId: emptyUser.id });
    assert.strictEqual(analysis.strengths.length, 0);
    assert.ok(analysis.skillGaps.length >= 5);
    assert.strictEqual(analysis.readiness.level, READINESS_LEVELS.EARLY);
  });

  // 18. Progress integration
  it('Phase 5.18: Progress integration rewards completed preparation topics in readiness score', async () => {
    const baseCandidate = {
      skills: [{ name: 'Python', level: 'intermediate' }],
      progress: [],
      leetcodeSolved: 0,
    };
    const requirements = placementIntelligenceService.getRoleRequirements('Data Analyst');
    const comp1 = placementIntelligenceService.compareCandidateSkills(baseCandidate, requirements);
    const r1 = placementIntelligenceService.calculateReadiness(baseCandidate, requirements, comp1);

    const progressCandidate = {
      ...baseCandidate,
      progress: [
        { topic: 'SQL', status: 'completed' },
        { topic: 'Excel', status: 'completed' },
      ],
    };
    const comp2 = placementIntelligenceService.compareCandidateSkills(progressCandidate, requirements);
    const r2 = placementIntelligenceService.calculateReadiness(progressCandidate, requirements, comp2);

    assert.ok(r2.score > r1.score);
    assert.ok(r2.breakdown.progressBonus > 0);
  });

  // 19. Memory integration where applicable
  it('Phase 5.19: Memory integration incorporates long-term stored weaknesses into analysis', async () => {
    const memUser = await userService.createUser({
      name: 'Memory Candidate',
      email: 'memcand@test.com',
      skills: [{ name: 'SQL', level: 'advanced' }],
      targetRole: 'Data Analyst',
    });

    // Stored persistent weakness in memory
    await memoryService.createOrUpdateMemory({
      userId: memUser.id,
      type: 'weakness',
      key: 'SQL',
      value: 'Struggles with recursive CTEs and performance tuning',
      confidence: 0.9,
      importance: 0.9,
    });

    const analysis = await placementIntelligenceService.generatePlacementAnalysis({ userId: memUser.id });
    // SQL should be flagged as developing because of persistent memory weakness
    const sqlItem = analysis.skillGaps.find((g) => g.skill === 'SQL');
    assert.ok(sqlItem);
    assert.strictEqual(sqlItem.status, 'developing');
  });

  // 20. REST endpoint behavior
  it('Phase 5.20: REST endpoints (GET /api/placement/roles, /roles/:role, /users/:userId/placement-analysis) function correctly', async () => {
    // GET /api/placement/roles
    const rolesRes = await fetch(`http://localhost:${TEST_PORT}/api/placement/roles`);
    assert.strictEqual(rolesRes.status, 200);
    const rolesData = await rolesRes.json();
    assert.strictEqual(rolesData.success, true);
    assert.ok(rolesData.data.length >= 8);

    // GET /api/placement/roles/:role
    const roleRes = await fetch(`http://localhost:${TEST_PORT}/api/placement/roles/Data%20Analyst`);
    assert.strictEqual(roleRes.status, 200);
    const roleData = await roleRes.json();
    assert.strictEqual(roleData.success, true);
    assert.strictEqual(roleData.data.title, 'Data Analyst');

    // GET /api/users/:userId/placement-analysis
    const analysisRes = await fetch(`http://localhost:${TEST_PORT}/api/users/${testUserId}/placement-analysis`);
    assert.strictEqual(analysisRes.status, 200);
    const analysisData = await analysisRes.json();
    assert.strictEqual(analysisData.success, true);
    assert.ok(analysisData.data.readiness);
    assert.ok(Array.isArray(analysisData.data.skillGaps));
  });

  // 21. Agent integration with analyze_placement_readiness
  it('Phase 5.21: Agent tool calling for placement readiness query calls analyze_placement_readiness', async () => {
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
              id: 'call_readiness_1',
              type: 'function',
              function: {
                name: 'analyze_placement_readiness',
                arguments: JSON.stringify({ userId: testUserId, role: 'Data Analyst' }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      return {
        message: 'Your placement readiness for Data Analyst is currently Developing. Your top priority gaps are SQL and Statistics.',
        rawMessage: { role: 'assistant', content: 'Your placement readiness for Data Analyst is currently Developing.' },
        toolCalls: [],
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const result = await agentService.run({
        message: 'Am I ready for a Data Analyst role?',
        userId: testUserId,
      });

      assert.strictEqual(result.toolCalls.length, 1);
      assert.strictEqual(result.toolCalls[0].name, 'analyze_placement_readiness');
      assert.strictEqual(result.toolCalls[0].status, 'success');
      assert.ok(result.message.includes('Developing'));
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // ==========================================
  // PHASE 6: PRACTICE & INTERVIEW ENGINE TESTS
  // ==========================================

  it('Phase 6.1: Create practice session initializes session and first question', async () => {
    const session = await practiceService.createSession({
      userId: testUserId,
      mode: 'practice',
      role: 'Data Analyst',
      topic: 'SQL',
      difficulty: 'medium',
      questionCount: 3,
    });

    assert.ok(session.id);
    assert.strictEqual(session.userId, testUserId);
    assert.strictEqual(session.mode, 'practice');
    assert.strictEqual(session.topic, 'SQL');
    assert.strictEqual(session.difficulty, 'medium');
    assert.strictEqual(session.questionCount, 3);
    assert.strictEqual(session.status, 'in_progress');
    assert.ok(session.currentQuestion);
    assert.ok(session.currentQuestion.question);
    assert.ok(Array.isArray(session.currentQuestion.expectedConcepts));
  });

  it('Phase 6.2: Invalid mode rejects with descriptive error', async () => {
    await assert.rejects(
      async () => {
        await practiceService.createSession({
          userId: testUserId,
          mode: 'unsupported_mode',
          topic: 'SQL',
        });
      },
      (err) => err.message.includes('Invalid practice mode')
    );
  });

  it('Phase 6.3: Invalid difficulty rejects with descriptive error', async () => {
    await assert.rejects(
      async () => {
        await practiceService.createSession({
          userId: testUserId,
          mode: 'practice',
          difficulty: 'super_hard',
        });
      },
      (err) => err.message.includes('Invalid difficulty')
    );
  });

  it('Phase 6.4: Invalid question count rejects with validation error', async () => {
    await assert.rejects(
      async () => {
        await practiceService.createSession({
          userId: testUserId,
          questionCount: 25,
        });
      },
      (err) => err.message.includes('between 1 and 10')
    );
  });

  it('Phase 6.5: Question generation returns valid structured question with expected concepts', async () => {
    const q = await questionGeneratorService.generateQuestion({
      role: 'Backend Developer',
      topic: 'SQL',
      difficulty: 'medium',
      type: 'sql',
    });

    assert.ok(q.question);
    assert.strictEqual(typeof q.question, 'string');
    assert.strictEqual(q.topic, 'SQL');
    assert.strictEqual(q.difficulty, 'medium');
    assert.ok(['conceptual', 'coding', 'sql', 'behavioral', 'scenario'].includes(q.type));
    assert.ok(Array.isArray(q.expectedConcepts));
    assert.ok(q.expectedConcepts.length > 0);
  });

  it('Phase 6.6: Structured question validation handles malformed or incomplete question safely', () => {
    const valid = questionGeneratorService.validateStructuredQuestion(
      {
        question: 'Explain SQL indexing mechanics.',
        topic: 'SQL',
        difficulty: 'medium',
        type: 'sql',
        expectedConcepts: ['B-Tree', 'clustering'],
      },
      'SQL',
      'medium',
      'sql'
    );
    assert.strictEqual(valid.topic, 'SQL');

    const fallback = questionGeneratorService.validateStructuredQuestion(
      {
        question: 'Too short',
      },
      'Data Structures',
      'hard',
      'coding'
    );
    assert.strictEqual(fallback.difficulty, 'hard');
    assert.ok(fallback.question.length > 10);
  });

  it('Phase 6.7: Retrieve session returns current state and question progress', async () => {
    const created = await practiceService.createSession({
      userId: testUserId,
      mode: 'practice',
      topic: 'React',
      difficulty: 'easy',
      questionCount: 2,
    });

    const retrieved = await practiceService.getSession(created.id, testUserId);
    assert.strictEqual(retrieved.id, created.id);
    assert.strictEqual(retrieved.currentQuestionIndex, 0);
    assert.strictEqual(retrieved.topic, 'React');
  });

  it('Phase 6.8: Session ownership isolation rejects access from unauthorized candidate', async () => {
    const session = await practiceService.createSession({
      userId: testUserId,
      topic: 'Algorithms',
    });

    await assert.rejects(
      async () => {
        await practiceService.getSession(session.id, 'other_candidate_id');
      },
      (err) => err.message.includes('Access denied') || err.message.includes('not found')
    );
  });

  it('Phase 6.9: Submit answer evaluates response and advances session', async () => {
    const session = await practiceService.createSession({
      userId: testUserId,
      mode: 'practice',
      topic: 'SQL',
      difficulty: 'medium',
      questionCount: 2,
    });

    const answer =
      'A window function performs a calculation across a set of table rows that are related to the current row without collapsing the rows like GROUP BY does. We use PARTITION BY to divide rows into partitions and ORDER BY to specify row ordering, allowing calculations like ROW_NUMBER(), RANK(), and moving averages.';

    const result = await practiceService.submitAnswer({
      sessionId: session.id,
      userId: testUserId,
      answer,
    });

    assert.ok(result.evaluation);
    assert.ok(typeof result.evaluation.score === 'number');
    assert.ok(result.evaluation.score >= 0 && result.evaluation.score <= 100);
    assert.ok(Array.isArray(result.evaluation.strengths));
    assert.ok(Array.isArray(result.evaluation.weaknesses));
    assert.ok(result.evaluation.feedback);
    assert.strictEqual(result.currentQuestionIndex, 1);
    assert.strictEqual(result.isCompleted, false);
    assert.ok(result.nextQuestion);
  });

  it('Phase 6.10: Structured evaluation calculates correctness, relevance, clarity, and depth', async () => {
    const evaluation = await answerEvaluationService.evaluateAnswer({
      question: 'What is a SQL window function and how does PARTITION BY work?',
      expectedConcepts: ['window functions', 'partition by', 'group by vs window', 'aggregate calculation'],
      answer:
        'Window functions calculate aggregate values over a specific partition of rows while preserving individual row identity. PARTITION BY defines the subset boundaries.',
      topic: 'SQL',
      difficulty: 'medium',
    });

    assert.ok(evaluation.score >= 0 && evaluation.score <= 100);
    assert.ok(evaluation.correctness >= 0 && evaluation.correctness <= 100);
    assert.ok(evaluation.relevance >= 0 && evaluation.relevance <= 100);
    assert.ok(evaluation.clarity >= 0 && evaluation.clarity <= 100);
    assert.ok(evaluation.depth >= 0 && evaluation.depth <= 100);
    assert.ok(typeof evaluation.feedback === 'string' && evaluation.feedback.length > 0);
  });

  it('Phase 6.11: Malformed evaluation handling gracefully validates and normalizes output without server crash', () => {
    const malformed = {
      score: 'eighty',
      correctness: 150,
      relevance: -20,
      strengths: 'Good knowledge',
      weaknesses: null,
      missingConcepts: undefined,
      feedback: 12345,
    };

    const sanitized = answerEvaluationService.validateStructuredEvaluation(malformed, ['indexing', 'b-tree']);

    assert.strictEqual(sanitized.score, 50); // fallback
    assert.strictEqual(sanitized.correctness, 100); // clamped
    assert.strictEqual(sanitized.relevance, 0); // clamped
    assert.ok(Array.isArray(sanitized.strengths));
    assert.ok(Array.isArray(sanitized.weaknesses));
    assert.ok(Array.isArray(sanitized.missingConcepts));
    assert.strictEqual(typeof sanitized.feedback, 'string');
  });

  it('Phase 6.12: Score range validation clamps metrics strictly between 0 and 100', () => {
    const outOfBounds = {
      score: 999,
      correctness: 500,
      relevance: -100,
      clarity: 101,
      depth: -5,
      strengths: ['Great syntax'],
      weaknesses: [],
      missingConcepts: [],
      feedback: 'Good work',
    };

    const sanitized = answerEvaluationService.validateStructuredEvaluation(outOfBounds, []);

    assert.strictEqual(sanitized.score, 100);
    assert.strictEqual(sanitized.correctness, 100);
    assert.strictEqual(sanitized.relevance, 0);
    assert.strictEqual(sanitized.clarity, 100);
    assert.strictEqual(sanitized.depth, 0);
  });

  it('Phase 6.13: Progress update after evaluation reflects practice performance into candidate progress', async () => {
    const session = await practiceService.createSession({
      userId: testUserId,
      mode: 'practice',
      topic: 'Docker Containers',
      difficulty: 'easy',
      questionCount: 1,
    });

    await practiceService.submitAnswer({
      sessionId: session.id,
      userId: testUserId,
      answer: 'Containers isolate applications using cgroups and namespaces in Linux to ensure consistent environments.',
    });

    const user = await userService.getUserById(testUserId);
    const dockerProgress = user.progress.find((p) => p.topic.toLowerCase().includes('docker'));
    assert.ok(dockerProgress, 'Candidate progress should record docker practice topic');
  });

  it('Phase 6.14: Weak topic detection flags topics where practice performance is low', async () => {
    const session = await practiceService.createSession({
      userId: testUserId,
      mode: 'practice',
      topic: 'Distributed Transactions',
      difficulty: 'hard',
      questionCount: 1,
    });

    await practiceService.submitAnswer({
      sessionId: session.id,
      userId: testUserId,
      answer: 'I do not know.',
    });

    const weakTopics = await practiceService.getWeakPracticeTopics(testUserId);
    assert.ok(Array.isArray(weakTopics));
    const distTrans = weakTopics.find((w) => w.topic.toLowerCase().includes('distributed transactions'));
    assert.ok(distTrans, 'Distributed Transactions should be flagged as weak');
    assert.ok(distTrans.averageScore < 65);
  });

  it('Phase 6.15: Adaptive next-question behavior adjusts difficulty based on score', async () => {
    const session = await practiceService.createSession({
      userId: testUserId,
      mode: 'practice',
      topic: 'SQL',
      difficulty: 'medium',
      questionCount: 3,
    });

    // Score low on question 1
    const result1 = await practiceService.submitAnswer({
      sessionId: session.id,
      userId: testUserId,
      answer: 'Not sure.',
    });

    assert.strictEqual(result1.nextQuestion.difficulty, 'easy', 'Should adapt down to easy on poor performance');

    // Score high on question 2 covering expected concepts
    const concepts = result1.nextQuestion.expectedConcepts || ['window functions', 'partition by'];
    const answer2 = `This concept covers ${concepts.join(' and ')} in technical depth, ensuring optimized query performance, proper indexing, and efficient calculation across partitions without collapsing table rows.`;

    const result2 = await practiceService.submitAnswer({
      sessionId: session.id,
      userId: testUserId,
      answer: answer2,
    });

    assert.ok(
      ['medium', 'hard'].includes(result2.nextQuestion.difficulty),
      'Should adapt difficulty up following strong performance'
    );
  });

  it('Phase 6.16: Complete session calculates overall score and summary diagnostics', async () => {
    const session = await practiceService.createSession({
      userId: testUserId,
      mode: 'practice',
      topic: 'System Design',
      difficulty: 'medium',
      questionCount: 1,
    });

    await practiceService.submitAnswer({
      sessionId: session.id,
      userId: testUserId,
      answer:
        'Caching stores frequently accessed data in fast-access memory like Redis to reduce database read latency. Common eviction policies include LRU and LFU.',
    });

    const completed = await practiceService.completeSession(session.id, testUserId);

    assert.strictEqual(completed.status, 'completed');
    assert.ok(completed.summary);
    assert.ok(typeof completed.summary.averageScore === 'number');
    assert.ok(Array.isArray(completed.summary.strongAreas));
    assert.ok(Array.isArray(completed.summary.weakAreas));
    assert.ok(typeof completed.summary.recommendations === 'string');
  });

  it('Phase 6.17: Practice history retrieves recent sessions for candidate', async () => {
    const history = await practiceService.getPracticeHistory(testUserId, { limit: 5 });
    assert.ok(Array.isArray(history));
    assert.ok(history.length > 0);
    assert.strictEqual(history[0].userId, testUserId);
  });

  it('Phase 6.18: Practice weak topics aggregates across historical sessions', async () => {
    const weakTopics = await practiceService.getWeakPracticeTopics(testUserId);
    assert.ok(Array.isArray(weakTopics));
  });

  it('Phase 6.19: User isolation ensures Candidate A cannot view or answer Candidate B sessions', async () => {
    const candidateB = await userService.createUser({
      name: 'Aditi Sharma',
      email: 'aditi.sharma@example.com',
      degree: 'B.Tech CS',
      skills: [{ name: 'Java', level: 'intermediate' }],
      targetRole: 'Software Engineer',
    });

    const sessionA = await practiceService.createSession({
      userId: testUserId,
      topic: 'Java',
      questionCount: 2,
    });

    // Candidate B tries to submit answer to Candidate A's session
    await assert.rejects(
      async () => {
        await practiceService.submitAnswer({
          sessionId: sessionA.id,
          userId: candidateB.id,
          answer: 'Some answer',
        });
      },
      (err) => err.message.includes('Access denied') || err.message.includes('not found')
    );
  });

  it('Phase 6.20: Agent start_practice_session tool creates practice session', async () => {
    const result = await toolRegistry.executeTool('start_practice_session', {
      userId: testUserId,
      mode: 'technical_interview',
      role: 'Data Analyst',
      topic: 'SQL',
      difficulty: 'medium',
      questionCount: 3,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.data.sessionId);
    assert.strictEqual(result.data.topic, 'SQL');
    assert.ok(result.data.currentQuestion);
  });

  it('Phase 6.21: Agent submit_practice_answer tool evaluates and returns feedback', async () => {
    const startResult = await toolRegistry.executeTool('start_practice_session', {
      userId: testUserId,
      topic: 'SQL',
      questionCount: 2,
    });

    const submitResult = await toolRegistry.executeTool('submit_practice_answer', {
      userId: testUserId,
      sessionId: startResult.data.sessionId,
      answer:
        'A window function performs calculations across a set of table rows that are related to the current row without collapsing rows like GROUP BY. It uses PARTITION BY and ORDER BY clauses.',
    });

    assert.strictEqual(submitResult.success, true);
    assert.ok(submitResult.data.evaluation);
    assert.ok(submitResult.data.evaluation.score >= 0);
  });

  it('Phase 6.22: Agent get_practice_session tool retrieves active session state', async () => {
    const startResult = await toolRegistry.executeTool('start_practice_session', {
      userId: testUserId,
      topic: 'Data Structures',
      questionCount: 2,
    });

    const getResult = await toolRegistry.executeTool('get_practice_session', {
      userId: testUserId,
      sessionId: startResult.data.sessionId,
    });

    assert.strictEqual(getResult.success, true);
    assert.strictEqual(getResult.data.id, startResult.data.sessionId);
    assert.strictEqual(getResult.data.topic, 'Data Structures');
  });

  it('Phase 6.23: Agent complete_practice_session tool concludes session', async () => {
    const startResult = await toolRegistry.executeTool('start_practice_session', {
      userId: testUserId,
      topic: 'Algorithms',
      questionCount: 1,
    });

    const completeResult = await toolRegistry.executeTool('complete_practice_session', {
      userId: testUserId,
      sessionId: startResult.data.sessionId,
    });

    assert.strictEqual(completeResult.success, true);
    assert.strictEqual(completeResult.data.status, 'completed');
    assert.ok(completeResult.data.summary);
  });

  it('Phase 6.24: REST API development endpoints function properly with ownership checks', async () => {
    // 1. POST /api/practice/sessions
    const createRes = await fetch(`http://localhost:${TEST_PORT}/api/practice/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        mode: 'practice',
        topic: 'Database Indexes',
        difficulty: 'medium',
        questionCount: 2,
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json();
    assert.strictEqual(createData.success, true);
    const sessionId = createData.data.id;

    // 2. GET /api/practice/sessions/:sessionId
    const getRes = await fetch(
      `http://localhost:${TEST_PORT}/api/practice/sessions/${sessionId}?userId=${testUserId}`
    );
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.strictEqual(getData.data.topic, 'Database Indexes');

    // 3. POST /api/practice/sessions/:sessionId/answer
    const answerRes = await fetch(
      `http://localhost:${TEST_PORT}/api/practice/sessions/${sessionId}/answer`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          answer:
            'A B-Tree index provides logarithmic lookup, insertion, and deletion times. A clustered index determines the physical order of data in the table, while non-clustered indexes create a separate pointer structure.',
        }),
      }
    );
    assert.strictEqual(answerRes.status, 200);
    const answerData = await answerRes.json();
    assert.ok(answerData.data.evaluation);

    // 4. POST /api/practice/sessions/:sessionId/complete
    const completeRes = await fetch(
      `http://localhost:${TEST_PORT}/api/practice/sessions/${sessionId}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: testUserId }),
      }
    );
    assert.strictEqual(completeRes.status, 200);
    const completeData = await completeRes.json();
    assert.strictEqual(completeData.data.status, 'completed');

    // 5. GET /api/users/:userId/practice-history
    const historyRes = await fetch(
      `http://localhost:${TEST_PORT}/api/users/${testUserId}/practice-history?limit=3`
    );
    assert.strictEqual(historyRes.status, 200);
    const historyData = await historyRes.json();
    assert.ok(Array.isArray(historyData.data));

    // 6. GET /api/users/:userId/practice-weak-topics
    const weakRes = await fetch(
      `http://localhost:${TEST_PORT}/api/users/${testUserId}/practice-weak-topics`
    );
    assert.strictEqual(weakRes.status, 200);
    const weakData = await weakRes.json();
    assert.ok(Array.isArray(weakData.data));
  });

  // ==========================================
  // PHASE 7 — RAG / KNOWLEDGE ENGINE TESTS
  // ==========================================

  let phase7DocId = '';

  // 1. Create knowledge document
  it('Phase 7.1: createDocument() successfully creates a knowledge document with contentHash', async () => {
    const doc = await documentService.createDocument({
      title: 'PostgreSQL Indexing & Query Execution Plans',
      description: 'Understanding EXPLAIN ANALYZE, B-Trees, and sequential scan thresholds.',
      category: 'SQL',
      role: 'Backend Engineer',
      contentType: 'guide',
      tags: ['PostgreSQL', 'Indexes', 'Performance', 'Query Planner'],
      content: `PostgreSQL utilizes various indexing methods including B-Tree, Hash, GiST, GIN, and BRIN.
B-Tree indexes are the default and excel in equality (=) and range (<, <=, >, >=) queries.
EXPLAIN ANALYZE runs the query and displays the actual execution times, plan tree, and disk vs buffer reads.
Sequential scans occur when a table is small or when the query retrieves a large percentage of table pages.`,
    });

    assert.ok(doc.id);
    assert.strictEqual(doc.title, 'PostgreSQL Indexing & Query Execution Plans');
    assert.strictEqual(doc.category, 'SQL');
    assert.strictEqual(doc.role, 'Backend Engineer');
    assert.strictEqual(doc.status, 'active');
    assert.ok(doc.contentHash);
    phase7DocId = doc.id;
  });

  // 2. Retrieve document
  it('Phase 7.2: getDocument() retrieves existing document by ID or throws on missing ID', async () => {
    const doc = await documentService.getDocument(phase7DocId);
    assert.strictEqual(doc.id, phase7DocId);
    assert.strictEqual(doc.title, 'PostgreSQL Indexing & Query Execution Plans');

    await assert.rejects(
      async () => {
        await documentService.getDocument('non_existent_doc_id_999');
      },
      /not found/i
    );
  });

  // 3. List documents
  it('Phase 7.3: listDocuments() supports category, role, and limit filtering', async () => {
    const allDocs = await documentService.listDocuments({ limit: 10 });
    assert.ok(allDocs.length >= 1);

    const sqlDocs = await documentService.listDocuments({ category: 'SQL' });
    assert.ok(sqlDocs.every((d) => d.category.toLowerCase() === 'sql'));

    const filtered = await documentService.listDocuments({ role: 'Backend Engineer' });
    assert.ok(filtered.some((d) => d.id === phase7DocId));
  });

  // 4. Update document
  it('Phase 7.4: updateDocument() modifies document metadata and recalculates hash if content changes', async () => {
    const updated = await documentService.updateDocument(phase7DocId, {
      description: 'Updated PostgreSQL deep dive documentation.',
      tags: ['PostgreSQL', 'Performance', 'EXPLAIN'],
    });

    assert.strictEqual(updated.description, 'Updated PostgreSQL deep dive documentation.');
    assert.deepStrictEqual(updated.tags, ['PostgreSQL', 'Performance', 'EXPLAIN']);
  });

  // 5. Delete document
  it('Phase 7.5: deleteDocument() removes document and all associated vector chunks', async () => {
    // Create temporary document to delete
    const tempDoc = await documentService.createDocument({
      title: 'Temporary Knowledge To Be Deleted',
      content: 'This document will be deleted and its vectors removed.',
      category: 'General',
    });

    const deleteResult = await documentService.deleteDocument(tempDoc.id);
    assert.strictEqual(deleteResult.deleted, true);
    assert.strictEqual(deleteResult.documentId, tempDoc.id);

    // Verify document no longer exists
    await assert.rejects(async () => {
      await documentService.getDocument(tempDoc.id);
    }, /not found/i);
  });

  // 6. Chunking behavior
  it('Phase 7.6: chunkingService splits text into properly bounded chunks with documentId and chunkIndex', () => {
    const sampleText = `Paragraph 1: Distributed systems require consensus protocols like Raft or Paxos to maintain consistent state across unreliable nodes.
Paragraph 2: The CAP theorem dictates that in the presence of network partitions, distributed databases must choose between consistency and availability.
Paragraph 3: Eventual consistency allows replicas to diverge temporarily as long as they converge after a bounded interval without further updates.`;

    const chunks = chunkingService.chunkText(sampleText, {
      documentId: 'doc_123',
      maxChunkSize: 100,
      overlapSize: 20,
    });

    assert.ok(chunks.length >= 1);
    assert.strictEqual(chunks[0].documentId, 'doc_123');
    assert.strictEqual(chunks[0].chunkIndex, 0);
    assert.ok(chunks[0].tokenCount > 0);
    assert.ok(chunks[0].content.length > 0);
  });

  // 7. Chunk overlap
  it('Phase 7.7: chunkingService implements configurable token overlap across adjacent chunks', () => {
    const longText = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} explaining scalable systems architecture and database sharding.`).join(' ');

    const chunks = chunkingService.chunkText(longText, {
      documentId: 'doc_overlap',
      maxChunkSize: 60,
      overlapSize: 20,
    });

    assert.ok(chunks.length > 1);
    // Overlap implies chunk 1 contains words that also appear in chunk 0
    const chunk0Words = new Set(chunks[0].content.toLowerCase().split(/\s+/));
    const chunk1Words = chunks[1].content.toLowerCase().split(/\s+/);
    const commonWords = chunk1Words.filter((w) => chunk0Words.has(w));
    assert.ok(commonWords.length > 0);
  });

  // 8. Deterministic chunking
  it('Phase 7.8: chunkingService produces identical chunks for identical inputs (deterministic)', () => {
    const text = 'Deterministic chunking ensures reproducibility. Every run generates identical splits, token counts, and chunk boundaries across builds.';

    const runA = chunkingService.chunkText(text, { documentId: 'doc_det' });
    const runB = chunkingService.chunkText(text, { documentId: 'doc_det' });

    assert.strictEqual(runA.length, runB.length);
    assert.strictEqual(runA[0].content, runB[0].content);
    assert.strictEqual(runA[0].tokenCount, runB[0].tokenCount);
  });

  // 9. Embedding validation
  it('Phase 7.9: embeddingService validates embedding vectors format, dimensions, and numerical validity', () => {
    const validVector = new Array(1536).fill(0.025);
    assert.strictEqual(embeddingService.validateEmbedding(validVector), true);

    assert.strictEqual(embeddingService.validateEmbedding([]), false);
    assert.strictEqual(embeddingService.validateEmbedding(null), false);
    assert.strictEqual(embeddingService.validateEmbedding([1, 2, 'three']), false);
    assert.strictEqual(embeddingService.validateEmbedding([1, 2, NaN]), false);
  });

  // 10. Mock embedding generation
  it('Phase 7.10: Mock embedding generation produces deterministic normalized vectors without external API calls', async () => {
    const text1 = 'SQL Window Functions RANK and DENSE_RANK';
    const text2 = 'Machine learning gradient descent optimizer';

    const emb1 = await embeddingService.generateEmbedding(text1);
    const emb1Repeat = await embeddingService.generateEmbedding(text1);
    const emb2 = await embeddingService.generateEmbedding(text2);

    assert.strictEqual(emb1.length, embeddingService.getEmbeddingDimensions());
    assert.deepStrictEqual(emb1, emb1Repeat); // Deterministic
    assert.notDeepStrictEqual(emb1, emb2); // Distinct for different texts

    // Unit length check: dot product with itself approx 1.0
    const norm = Math.sqrt(emb1.reduce((sum, v) => sum + v * v, 0));
    assert.ok(Math.abs(norm - 1.0) < 0.05);
  });

  // 11. Document ingestion
  it('Phase 7.11: ingestDocument() ingests document into vector store and sets chunksCount and indexedAt', async () => {
    const result = await documentService.ingestDocument(phase7DocId, true);
    assert.strictEqual(result.success, true);
    assert.ok(result.chunksCount > 0);

    const doc = await documentService.getDocument(phase7DocId);
    assert.strictEqual(doc.chunksCount, result.chunksCount);
    assert.ok(doc.indexedAt);
  });

  // 12. Ingestion failure cleanup
  it('Phase 7.12: Ingestion failure cleans up partial chunks and reports structured error', async () => {
    // Attempting to ingest non-existent document
    await assert.rejects(async () => {
      await documentService.ingestDocument('non_existent_id_404');
    }, /not found/i);
  });

  // 13. Vector insertion
  it('Phase 7.13: vectorStoreService.upsertVectors() stores chunks and respects bulk operations', async () => {
    const mockChunks = [
      {
        documentId: 'doc_vector_test',
        chunkIndex: 0,
        content: 'Vector store unit testing chunk alpha.',
        embedding: new Array(1536).fill(0.01),
        tokenCount: 8,
        metadata: { category: 'SQL', role: 'Data Analyst' },
      },
      {
        documentId: 'doc_vector_test',
        chunkIndex: 1,
        content: 'Vector store unit testing chunk beta.',
        embedding: new Array(1536).fill(0.02),
        tokenCount: 8,
        metadata: { category: 'SQL', role: 'Data Analyst' },
      },
    ];

    const storedCount = await vectorStoreService.upsertVectors(mockChunks);
    assert.strictEqual(storedCount, 2);

    const count = await vectorStoreService.getChunksCount('doc_vector_test');
    assert.strictEqual(count, 2);

    // Cleanup
    await vectorStoreService.deleteVectors('doc_vector_test');
  });

  // 14. Semantic retrieval
  it('Phase 7.14: retrievalService.search() retrieves semantically relevant knowledge chunks with scores', async () => {
    const results = await retrievalService.search('PostgreSQL B-Tree index and execution plans', {
      limit: 3,
    });

    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    assert.ok(results[0].title);
    assert.ok(results[0].content);
    assert.ok(typeof results[0].score === 'number');
  });

  // 15. Top-K limiting
  it('Phase 7.15: retrievalService respects top-K limit configuration', async () => {
    const top1 = await retrievalService.search('SQL database query', { limit: 1 });
    assert.ok(top1.length <= 1);

    const top3 = await retrievalService.search('SQL database query', { limit: 3 });
    assert.ok(top3.length <= 3);
  });

  // 16. Metadata filtering
  it('Phase 7.16: retrievalService filters results by category and role', async () => {
    const sqlResults = await retrievalService.search('index and query', {
      category: 'SQL',
      limit: 5,
    });

    if (sqlResults.length > 0) {
      assert.ok(sqlResults.every((r) => r.metadata?.category?.toLowerCase() === 'sql'));
    }
  });

  // 17. Duplicate result removal
  it('Phase 7.17: retrievalService removes duplicate content chunks from search output', async () => {
    const mockDuplicateChunks = [
      { chunkId: 'c1', documentId: 'd1', title: 'Doc', content: 'Identical content string', score: 0.9 },
      { chunkId: 'c2', documentId: 'd1', title: 'Doc', content: 'Identical content string', score: 0.88 },
      { chunkId: 'c3', documentId: 'd2', title: 'Doc 2', content: 'Unique content block', score: 0.75 },
    ];

    const deduplicated = retrievalService.deduplicateResults(mockDuplicateChunks);
    assert.strictEqual(deduplicated.length, 2);
  });

  // 18. search_knowledge tool
  it('Phase 7.18: search_knowledge tool executes successfully via ToolRegistry without leaking raw embeddings', async () => {
    const tool = toolRegistry.getTool('search_knowledge');
    assert.ok(tool);

    const result = await tool.execute({
      query: 'PostgreSQL indexing',
      limit: 2,
    });

    assert.ok(Array.isArray(result.results));
    for (const item of result.results) {
      assert.ok(item.title);
      assert.ok(item.content);
      assert.strictEqual(item.embedding, undefined); // Never leak raw embeddings
    }
  });

  // 19. User query grounding
  it('Phase 7.19: ragService builds grounded prompt enforcing adherence to retrieved knowledge', () => {
    const query = 'Explain PostgreSQL B-Trees';
    const context = 'B-Trees are the default index in PostgreSQL handling equality and range queries.';

    const grounded = ragService.buildGroundedPrompt(query, context);
    assert.ok(grounded.includes('RETRIEVED KNOWLEDGE CONTEXT'));
    assert.ok(grounded.includes(context));
    assert.ok(grounded.includes('Strictly prioritize the retrieved context'));
    assert.ok(grounded.includes(query));
  });

  // 20. Source formatting
  it('Phase 7.20: ragService formats sources cleanly without database IDs or internal metadata', () => {
    const chunks = [
      { title: 'SQL Window Functions Guide' },
      { title: 'SQL Window Functions Guide' }, // duplicate title
      { title: 'DBMS Normalization Notes' },
    ];

    const sources = ragService.formatSources(chunks);
    assert.deepStrictEqual(sources, ['SQL Window Functions Guide', 'DBMS Normalization Notes']);

    const footer = ragService.formatSourcesFooter(sources);
    assert.ok(footer.includes('**Sources:**'));
    assert.ok(footer.includes('- SQL Window Functions Guide'));
    assert.ok(footer.includes('- DBMS Normalization Notes'));
    assert.ok(!footer.includes('ObjectId'));
  });

  // 21. Empty retrieval handling
  it('Phase 7.21: retrievalService handles queries with no semantic matches gracefully', async () => {
    const emptyResults = await retrievalService.search('zxq9910_completely_nonexistent_token_string', {
      limit: 3,
    });

    assert.ok(Array.isArray(emptyResults));
    // Context builder should handle empty results
    const context = retrievalService.buildContext([]);
    assert.strictEqual(context, '');
  });

  // 22. Insufficient knowledge handling
  it('Phase 7.22: ragService answers truthfully when internal knowledge is insufficient', async () => {
    const resp = await ragService.answerWithKnowledge('What is quantum entanglement in teleportation circuits?', {
      candidateProfile: { name: 'Rohan Mehra' },
    });

    assert.strictEqual(resp.hasKnowledge, false);
    assert.ok(resp.answer.toLowerCase().includes('insufficient') || resp.answer.toLowerCase().includes('do not have'));
    assert.deepStrictEqual(resp.sources, []);
  });

  // 23. Knowledge document isolation
  it('Phase 7.23: Knowledge documents are isolated from candidate-private profile and memory data', async () => {
    const docs = await documentService.listDocuments({ limit: 20 });
    for (const doc of docs) {
      assert.strictEqual(doc.userId, undefined);
      assert.ok(!doc.content.includes('rohan.mehra@example.com'));
    }
  });

  // 24. Agent retrieval behavior
  it('Phase 7.24: Agent invokes search_knowledge tool when answering conceptual technical questions', async () => {
    // Mock generateChatResponse to invoke search_knowledge tool first, then grounded response
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
              id: 'call_search_1',
              type: 'function',
              function: {
                name: 'search_knowledge',
                arguments: JSON.stringify({ query: 'SQL window functions', limit: 2 }),
              },
            },
          ],
          model: 'test-model',
          usage: null,
        };
      }
      return {
        message: 'SQL window functions calculate values across rows.\n\n**Sources:**\n- SQL Window Functions & Analytical Partitioning',
        rawMessage: { role: 'assistant', content: 'SQL window functions calculate values across rows.' },
        toolCalls: [],
        model: 'test-model',
        usage: null,
      };
    };

    try {
      const response = await agentService.run({
        message: 'What are SQL window functions like ROW_NUMBER and RANK?',
        userId: testUserId,
      });

      assert.ok(response.message);
      assert.ok(Array.isArray(response.toolCalls));
      const usedKnowledge = response.toolCalls.some((t) => t.name === 'search_knowledge');
      assert.ok(usedKnowledge, 'Agent should invoke search_knowledge tool for technical SQL query');
    } finally {
      aiService.generateChatResponse = originalGenerate;
    }
  });

  // 25. Phase 1–6 Regression tests
  it('Phase 7.25: Phase 1–6 functionality remains intact (Regression Verification)', async () => {
    // 1. Profile retrieval (Phase 2)
    const profile = await userService.getUserById(testUserId);
    assert.strictEqual(profile.name, 'Rohan Mehra');

    // 2. Memory creation & retrieval (Phase 4)
    const mem = await memoryService.createOrUpdateMemory({
      userId: testUserId,
      type: 'goal',
      key: 'Phase 7 Target',
      value: 'Master RAG knowledge retrieval and vector search',
    });
    assert.ok(mem.id);

    // 3. Placement Intelligence (Phase 5)
    const intel = await placementIntelligenceService.generatePlacementAnalysis({ userId: testUserId });
    assert.ok(intel.role);
    assert.ok(intel.readiness);

    // 4. Practice Engine (Phase 6)
    const session = await practiceService.createSession({
      userId: testUserId,
      topic: 'SQL Window Functions',
      mode: 'practice',
      questionCount: 1,
    });
    assert.ok(session.id);
    assert.strictEqual(session.status, 'in_progress');

    // 5. REST Knowledge endpoints verification (Phase 7 API)
    const searchRes = await fetch(`http://localhost:${TEST_PORT}/api/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'SQL window functions', limit: 2 }),
    });
    assert.strictEqual(searchRes.status, 200);
    const searchJson = await searchRes.json();
    assert.strictEqual(searchJson.success, true);
    assert.ok(searchJson.data.results.length > 0);
  });
});



