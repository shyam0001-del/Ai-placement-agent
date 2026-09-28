import express from 'express';
import cors from 'cors';
import { config, validateAiConfig } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import chatRoutes from './routes/chat.routes.js';
import { successResponse } from './utils/apiResponse.js';

const app = express();

// Security & Parsing Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching origin
      if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      return callback(null, true); // Dev-friendly permissive for local dev
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// Health & System Info
app.get('/api/health', (req, res) => {
  const { isValid, missing } = validateAiConfig();
  return successResponse(res, {
    status: 'online',
    service: 'AI Placement Agent Server',
    configuredModel: config.openai.model || 'Not configured',
    aiReady: isValid,
    ...(missing.length > 0 ? { missingEnv: missing } : {}),
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api', chatRoutes);

// 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
