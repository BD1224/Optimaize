// The Upgrade pipeline: re-run one answer on the next model up. No Electron imports.
import type {
  ChatMessage,
  Difficulty,
  Role,
  TokenUsage,
  UpgradeMessageRequest,
  UpgradeMessageResult,
} from '../../shared/chat';
import type { Feedback } from '../router/feedback';
import { nextModel } from '../router/models';

export interface UpgradeMessageDeps {
  db: { saveMessage(chatId: string, role: Role, content: string): ChatMessage };
  context: {
    prepare(chatId: string): Promise<{ chatId: string; messages: ChatMessage[]; rolledOver: boolean }>;
  };
  providers: {
    streamReply(args: {
      model: string;
      messages: ChatMessage[];
      onToken: (delta: string) => void;
    }): Promise<{ text: string; usage: TokenUsage }>;
  };
  usage: {
    log(args: {
      chatId: string;
      model: string;
      difficulty: Difficulty;
      kind: 'classifier' | 'reply';
      usage: TokenUsage;
      messageId?: string;
      parentMessageId?: string;
      isUpgrade?: boolean;
      language?: string;
    }): { costUsd: number };
  };
  feedback: Pick<Feedback, 'recordUpgrade'>;
}

export class AlreadyAtTopModelError extends Error {
  constructor(model: string) {
    super(`${model} is already the most capable model`);
    this.name = 'AlreadyAtTopModelError';
  }
}

export async function upgradeMessage(
  deps: UpgradeMessageDeps,
  req: UpgradeMessageRequest,
  onToken: (delta: string) => void,
): Promise<UpgradeMessageResult> {
  const model = nextModel(req.fromModel);
  if (!model) throw new AlreadyAtTopModelError(req.fromModel);

  // Re-ask the same question: same history, minus the answer being replaced
  const ctx = await deps.context.prepare(req.chatId);
  const messages = ctx.messages.filter((m) => m.id !== req.replyMessageId);

  const { text, usage } = await deps.providers.streamReply({ model, messages, onToken });

  const reply = deps.db.saveMessage(ctx.chatId, 'assistant', text);

  // Logged as part of the original exchange (parentMessageId), so the dashboard counts the
  // wasted first attempt as cost and baselines the exchange once.
  const { costUsd } = deps.usage.log({
    chatId: ctx.chatId,
    model,
    difficulty: req.difficulty,
    kind: 'reply',
    usage,
    messageId: reply.id,
    parentMessageId: req.userMessageId,
    isUpgrade: true,
    language: req.language,
  });

  // Teach the router: this kind of question needed more power
  deps.feedback.recordUpgrade({ category: req.category, difficulty: req.difficulty, toModel: model });

  return { reply, model, fromModel: req.fromModel, usage, costUsd };
}
