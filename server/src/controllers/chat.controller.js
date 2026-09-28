import { aiService } from '../services/ai/ai.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Handle incoming chat message
 * POST /api/chat
 * Body: { message: string, history?: Array<{role: string, content: string}> }
 */
export async function handleChatMessage(req, res, next) {
  try {
    const { message, history } = req.body || {};

    if (!message && (!history || !Array.isArray(history) || history.length === 0)) {
      return errorResponse(
        res,
        'Invalid request: "message" string is required in request body.',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (message && typeof message !== 'string') {
      return errorResponse(
        res,
        '"message" field must be a valid non-empty string.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const trimmedMessage = message ? message.trim() : '';
    if (!trimmedMessage && (!history || history.length === 0)) {
      return errorResponse(
        res,
        'Message cannot be blank.',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Support both single message and conversation history if provided
    let inputPayload = trimmedMessage;
    if (Array.isArray(history) && history.length > 0) {
      inputPayload = [
        ...history,
        ...(trimmedMessage ? [{ role: 'user', content: trimmedMessage }] : []),
      ];
    }

    const aiResult = await aiService.generateChatResponse(inputPayload);

    // Provide Section 18 standard format, while also keeping top-level message for Section 5 compatibility
    return res.status(200).json({
      success: true,
      message: aiResult.message,
      data: {
        message: aiResult.message,
        model: aiResult.model,
        usage: aiResult.usage,
      },
    });
  } catch (error) {
    next(error);
  }
}
