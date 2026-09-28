import { aiService } from '../services/ai/ai.service.js';
import { userService, formatProfileContext } from '../services/user/user.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Handle incoming chat message
 * POST /api/chat
 * Body: { message: string, history?: Array<{role: string, content: string}>, userId?: string }
 */
export async function handleChatMessage(req, res, next) {
  try {
    const { message, history, userId } = req.body || {};

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

    // Optional user profile context retrieval (Phase 2)
    let profileContext = '';
    if (userId) {
      if (typeof userId !== 'string' || !userId.trim()) {
        return errorResponse(res, 'User ID must be a non-empty string if provided.', 400, 'VALIDATION_ERROR');
      }

      const user = await userService.getUserById(userId.trim());
      if (!user) {
        return errorResponse(res, `User with ID "${userId}" was not found.`, 404, 'USER_NOT_FOUND');
      }

      profileContext = formatProfileContext(user);
    }

    // Support both single message and conversation history if provided
    let inputPayload = trimmedMessage;
    if (Array.isArray(history) && history.length > 0) {
      inputPayload = [
        ...history,
        ...(trimmedMessage ? [{ role: 'user', content: trimmedMessage }] : []),
      ];
    }

    const aiResult = await aiService.generateChatResponse(inputPayload, {
      profileContext: profileContext || undefined,
    });

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
