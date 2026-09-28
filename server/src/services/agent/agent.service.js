import { aiService } from '../ai/ai.service.js';
import { toolRegistry } from '../tools/index.js';

export const AGENT_LIMITS = {
  MAX_ITERATIONS: 5,
  MAX_TOOL_CALLS: 8,
  TIMEOUT_MS: 30000,
};

export class AgentService {
  constructor() {
    this.limits = AGENT_LIMITS;
  }

  /**
   * Controlled agent execution loop (Section 5)
   *
   * @param {Object} params
   * @param {string} params.message - Current user query
   * @param {Array<{role: string, content: string}>} [params.history] - Prior conversation turns
   * @param {string} [params.userId] - Active candidate ID
   * @param {Object} [params.options] - Override limits (timeoutMs, maxIterations, maxToolCalls)
   * @returns {Promise<{message: string, model: string, usage: Object, iterations: number, toolCalls: Array}>}
   */
  async run({ message, history = [], userId = null, options = {} }) {
    const startTime = Date.now();
    const maxIterations = options.maxIterations || this.limits.MAX_ITERATIONS;
    const maxToolCalls = options.maxToolCalls || this.limits.MAX_TOOL_CALLS;
    const timeoutMs = options.timeoutMs || this.limits.TIMEOUT_MS;

    console.log(`[Agent Start] Query: "${message.slice(0, 80)}" | userId: ${userId || 'none'}`);

    let systemPrompt =
      'You are the AI Placement Agent, an intelligent, empathetic, and rigorous placement preparation co-pilot for engineering candidates. ' +
      'Your goal is to help candidates crack their target technical roles. ' +
      'You have access to tools to inspect and update candidate profile details and preparation progress. ' +
      'When the user asks about their skills, profile, progress, weak areas, or wants to update a topic, SELECT AND EXECUTE the appropriate tool. ' +
      'If the request is a general question, conceptual explanation, or greeting, answer directly without invoking tools.';

    if (userId) {
      systemPrompt += `\n\nActive Candidate Context:\nThe current candidate's userId is "${userId}". Always pass this userId when calling candidate tools.`;
    }

    // Build conversation array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter((m) => !m.isError),
      { role: 'user', content: message },
    ];

    const availableTools = toolRegistry.getDefinitions();
    const executedTools = [];
    let totalToolCalls = 0;
    let iteration = 0;
    let lastResponse = null;

    while (iteration < maxIterations) {
      iteration++;

      // Check timeout guardrail
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`[Agent Timeout] Exceeded ${timeoutMs}ms limit.`);
        const timeoutErr = new Error(`Agent execution timed out after ${timeoutMs}ms.`);
        timeoutErr.code = 'AGENT_TIMEOUT';
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }

      console.log(`[Agent Iteration ${iteration}/${maxIterations}] Requesting model...`);

      const response = await aiService.generateChatResponse(messages, {
        tools: availableTools.length > 0 ? availableTools : undefined,
      });

      lastResponse = response;

      // Check if model requested tool call(s)
      const toolCalls = response.toolCalls;
      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        console.log(`[Agent Model Response] Iteration ${iteration} produced ${toolCalls.length} tool call(s).`);

        // Append assistant tool-calls message to history
        messages.push({
          role: 'assistant',
          content: response.rawMessage?.content || null,
          tool_calls: toolCalls,
        });

        // Execute each tool call
        for (const call of toolCalls) {
          totalToolCalls++;

          if (totalToolCalls > maxToolCalls) {
            console.warn(`[Agent Guardrail] Reached max tool calls limit (${maxToolCalls}).`);
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.function?.name || 'unknown',
              content: JSON.stringify({
                success: false,
                error: {
                  code: 'MAX_TOOL_CALLS_EXCEEDED',
                  message: `Maximum allowed tool executions (${maxToolCalls}) exceeded.`,
                },
              }),
            });
            break;
          }

          const toolName = call.function?.name;
          let toolArgs = {};

          try {
            toolArgs = typeof call.function?.arguments === 'string'
              ? JSON.parse(call.function.arguments)
              : call.function?.arguments || {};
          } catch (jsonErr) {
            console.warn(`[Agent Argument Error] Tool "${toolName}" received invalid JSON arguments:`, call.function?.arguments);
            toolArgs = {};
          }

          // Automatically inject active userId if tool requires it and model omitted it
          if (userId && !toolArgs.userId && (toolName === 'get_user_profile' || toolName === 'get_user_progress' || toolName === 'update_user_progress')) {
            toolArgs.userId = userId;
          }

          console.log(`[Tool Selected] "${toolName}" | Args:`, JSON.stringify(toolArgs));

          const toolStart = Date.now();
          const toolResult = await toolRegistry.executeTool(toolName, toolArgs);
          const toolDuration = Date.now() - toolStart;

          console.log(
            `[Tool Result] "${toolName}" in ${toolDuration}ms | Success: ${toolResult.success}`
          );

          executedTools.push({
            name: toolName,
            args: toolArgs,
            success: toolResult.success,
            durationMs: toolDuration,
          });

          // Append structured tool response to prompt context
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: toolName,
            content: JSON.stringify(toolResult),
          });
        }

        // Loop continues so model can observe tool results and reason further
        continue;
      }

      // No tool calls produced -> final answer reached
      console.log(`[Agent Finish] Completed in ${iteration} iteration(s), ${totalToolCalls} tool call(s).`);
      return {
        message: response.message,
        model: response.model,
        usage: response.usage,
        iterations: iteration,
        toolCalls: executedTools,
      };
    }

    // Maximum iterations reached safety exit
    console.warn(`[Agent Max Iterations] Reached limit of ${maxIterations} iterations.`);
    return {
      message:
        lastResponse?.message ||
        "I have gathered the required information from your preparation records to assist your placement journey.",
      model: lastResponse?.model || 'configured model',
      usage: lastResponse?.usage || null,
      iterations: iteration,
      toolCalls: executedTools,
      maxIterationsReached: true,
    };
  }
}

export const agentService = new AgentService();
