// Heuristic task classifier: no LLM call, so routing costs zero tokens.
import type { TaskType } from '../../shared/models';

// Keywords are mostly English plus a few common French/Spanish/Portuguese ones.
// Other languages fall through to "chat" unless a structural signal matches.
const RULES: { task: TaskType; pattern: RegExp }[] = [
  { task: 'code', pattern: /```|=>|\b(function|def|class|const|import|stacktrace|traceback|compile[rd]?|bug|código|code|fonction)\b|[{};]\s*$/im },
  { task: 'math', pattern: /\d\s*[-+*/^=]\s*\d|\b(solve|equation|integral|derivative|calculate|calcul\w*|ecuaci\w+|équation|matemáticas|mathématiques)\b/i },
  { task: 'writing', pattern: /\b(write|rewrite|essay|email|letter|poem|story|draft|écri\w+|rédig\w+|escrib\w+|redact\w+|escrev\w+|correo|courriel)\b/i },
  { task: 'analysis', pattern: /\b(analy[sz]e|compare|summari[sz]e|explain|why|résume|explique|analyse|resume|explica|compara)\b/i },
];

export function classifyTask(text: string): TaskType {
  for (const { task, pattern } of RULES) {
    if (pattern.test(text)) return task;
  }
  return 'chat';
}
