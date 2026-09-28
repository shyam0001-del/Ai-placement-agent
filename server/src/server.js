import app from './app.js';
import { config, validateAiConfig } from './config/env.js';

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 AI Placement Agent Server running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔍 Environment: ${config.nodeEnv}`);
  
  const { isValid, missing } = validateAiConfig();
  if (isValid) {
    console.log(`🤖 AI Engine: Ready (Model: ${config.openai.model})`);
  } else {
    console.warn(`⚠️  AI Warning: Missing config: ${missing.join(', ')}`);
    console.warn(`👉 Please set them in server/.env before calling /api/chat`);
  }
  console.log(`===============================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
  });
});
