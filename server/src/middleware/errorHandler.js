import { errorResponse } from '../utils/apiResponse.js';

/**
 * Centralized error-handling middleware
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected server error occurred';

  // Log server-side with context without exposing secrets
  console.error(`[ERROR] [${req.method} ${req.originalUrl}] [${code}]:`, message);

  // Return clean, standardized client error without stack trace
  return errorResponse(res, message, statusCode, code);
}

/**
 * 404 Route Not Found handler
 */
export function notFoundHandler(req, res) {
  return errorResponse(
    res,
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'NOT_FOUND'
  );
}
