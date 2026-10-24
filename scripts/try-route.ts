// Full flow without the UI: npm run build && node --env-file=.env dist/scripts/try-route.js "message" [pool|explicit]
import { complete } from '../src/main/providers/openrouter';
import { route, type RoutingMode } from '../src/main/router';

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Set OPENROUTER_API_KEY in .env');

  const [text = 'Peux-tu m’expliquer comment fonctionne un tokenizer ?', mode = 'explicit'] = process.argv.slice(2);
  const decision = route(text, mode as RoutingMode);
  console.log(JSON.stringify(decision, null, 2));

  const r = await complete(apiKey, [{ role: 'user', content: text }], decision.choice);
  console.log('\n' + r.content);
  console.log('\n---', r.model, r.usage, `$${r.costUsd}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
