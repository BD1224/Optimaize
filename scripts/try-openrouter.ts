// Manual smoke test: npm run try -- "your message" [model-id]
// Needs OPENROUTER_API_KEY in .env
import { complete, type ModelChoice } from '../src/main/providers/openrouter';

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Set OPENROUTER_API_KEY in .env');

  const [text = 'Bonjour, comment ça va ?', model = 'google/gemma-4-31b-it:free'] = process.argv.slice(2);
  const choice: ModelChoice = { kind: 'explicit', model };

  const r = await complete(apiKey, [{ role: 'user', content: text }], choice);
  console.log(r.content);
  console.log('\n---', r.model, r.usage, `$${r.costUsd}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
