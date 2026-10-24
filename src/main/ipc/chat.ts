// chat:send logic. Electron registration happens in main/index.ts; this stays plain
// so it can be run from scripts.
import { randomUUID } from 'node:crypto';
import type { SendMessageRequest, SendMessageResult } from '../../shared/chat';
import { addMessage, chatExists, createChat, getMessages, logUsage, type Db } from '../db';
import { SYSTEM_PROMPT } from '../prompts/system';
import { complete, type LlmMessage } from '../providers/openrouter';
import { route } from '../router';
import { baselineCost } from '../usage/pricing';

export async function sendMessage(db: Db, apiKey: string, req: SendMessageRequest): Promise<SendMessageResult> {
  if (!req.text.trim()) throw new Error('Message is empty');
  if (!chatExists(db, req.chatId)) createChat(db, null, req.chatId);

  const { language, choice } = route(req.text, 'explicit', req.modelOverride);

  const history: LlmMessage[] = getMessages(db, req.chatId).map((m) => ({ role: m.role, content: m.content }));
  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: req.text },
  ];

  // Call first, so a failed request leaves no dangling user message in the chat
  const result = await complete(apiKey, messages, choice);

  const userMessage = addMessage(db, { chatId: req.chatId, role: 'user', content: req.text, language });
  const reply = addMessage(db, {
    chatId: req.chatId,
    role: 'assistant',
    content: result.content,
    model: result.model,
    language,
  });

  logUsage(db, {
    id: randomUUID(),
    messageId: reply.id,
    isRetry: false,
    model: result.model,
    language,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: result.costUsd,
    baselineCostUsd: baselineCost(result.usage),
    createdAt: Date.now(),
  });

  return { userMessage, reply, model: result.model, language, usage: result.usage, costUsd: result.costUsd };
}
