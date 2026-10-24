// Quick check: npm run build && node dist/scripts/try-db.js
import { addMessage, createChat, getMessages, logUsage, openDb } from '../src/main/db';

const db = openDb(':memory:');
const chatId = createChat(db, 'test');
const q = addMessage(db, { chatId, role: 'user', content: 'Bonjour', language: 'fr' });
addMessage(db, { chatId, role: 'assistant', content: 'Salut !', model: 'test/model' });
logUsage(db, {
  id: 'u1', messageId: q.id, isRetry: false, model: 'test/model', language: 'fr',
  inputTokens: 3, outputTokens: 5, costUsd: 0, baselineCostUsd: 0, createdAt: Date.now(),
});
console.log(getMessages(db, chatId).map((m) => `${m.role}: ${m.content}`));
console.log(db.prepare('SELECT COUNT(*) AS n FROM usage_log').get());
