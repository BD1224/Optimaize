// Multi-turn chat from the terminal, stored in chat.sqlite: npm run chat
import { createInterface } from 'node:readline/promises';
import { openDb } from '../src/main/db';
import { sendMessage } from '../src/main/ipc/chat';

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Set OPENROUTER_API_KEY in .env');

  const db = openDb('chat.sqlite');
  const chatId = 'terminal-chat';
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log('Type a message (Ctrl+C to quit). Free models only.');
  for (;;) {
    const text = await rl.question('\nyou> ');
    try {
      const r = await sendMessage(db, apiKey, { chatId, text });
      console.log(`\n${r.reply.content}\n[${r.language} | ${r.model} | ${r.usage.inputTokens}+${r.usage.outputTokens} tokens | $${r.costUsd}]`);
    } catch (e) {
      console.error('error:', (e as Error).message);
    }
  }
}

main();
