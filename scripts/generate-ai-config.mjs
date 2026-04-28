/**
 * Generates .z-ai-config from environment variables at build time.
 * Required env vars: ZAI_BASE_URL, ZAI_API_KEY
 * Optional env vars: ZAI_CHAT_ID, ZAI_USER_ID
 */
import { writeFileSync, existsSync } from 'fs';

const baseUrl = process.env.ZAI_BASE_URL;
const apiKey = process.env.ZAI_API_KEY;
const chatId = process.env.ZAI_CHAT_ID || '';
const userId = process.env.ZAI_USER_ID || '';

if (baseUrl && apiKey) {
  const config = { baseUrl, apiKey, chatId, userId };
  writeFileSync('.z-ai-config', JSON.stringify(config, null, 2));
  console.log('✅ .z-ai-config generated from environment variables');
} else if (existsSync('.z-ai-config')) {
  console.log('ℹ️  .z-ai-config already exists, skipping generation');
} else {
  console.warn('⚠️  ZAI_BASE_URL or ZAI_API_KEY not set — AI grading features will be unavailable');
}
