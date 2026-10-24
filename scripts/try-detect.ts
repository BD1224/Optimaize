// Quick check: npm run build && node dist/scripts/try-detect.js
import { detectLanguage } from '../src/main/language/detect';

const samples = [
  'Hello, how are you today?',
  'Bonjour, comment ça va ?',
  'Hola, ¿puedes ayudarme con mi tarea de matemáticas?',
  'Ola, voce pode me ajudar com este codigo?',
  'Bonjou, kijan ou ye? Mwen bezwen èd.',
  'आप कैसे हैं? मुझे मदद चाहिए',
  '你好，你能帮我写一封邮件吗？',
  'ok',
  'Hallo, wie geht es dir?',
];

for (const s of samples) console.log(detectLanguage(s).padEnd(4), s);
