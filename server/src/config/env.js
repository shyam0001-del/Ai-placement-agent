import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root or parent directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also attempt fallback to current working directory .env
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || '',
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  },
  mongodbUri: process.env.MONGODB_URI || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};

/**
 * Validates critical environment variables required for AI operations
 */
export function validateAiConfig() {
  const missing = [];
  if (!config.openai.apiKey) {
    missing.push('OPENAI_API_KEY');
  }
  if (!config.openai.model) {
    missing.push('OPENAI_MODEL');
  }
  return {
    isValid: missing.length === 0,
    missing,
  };
}
