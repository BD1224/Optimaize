// The Upgrade pipeline: re-run one answer on the next model up. No Electron imports.
import type {
  ChatMessage,
  Difficulty,
  MessageMeta,
  Role,
  TokenUsage,
  UpgradeMessageRequest,
  UpgradeMessageResult,
} from '../../shared/chat';
import type { Feedback } from '../router/feedback';
import { MODELS, nextModel } from '../router/models';

const LADDER: readonly string[] = [MODELS.haiku, MODELS.sonnet, MODELS.opus];

export interface UpgradeMessageDeps {
  db: { saveMessage(chatId: string, role: Role, content: string, meta?: MessageMeta): ChatMessage };
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

export class InvalidUpgradeError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot upgrade from ${from} to ${to}`);
    this.name = 'InvalidUpgradeError';
  }
}

// One step up by default, or the bigger model the user picked
function targetModel(from: string, toModel?: string): string {
  if (!toModel) {
    const next = nextModel(from);
    if (!next) throw new AlreadyAtTopModelError(from);
    return next;
  }
  if (LADDER.indexOf(toModel) <= LADDER.indexOf(from) || LADDER.indexOf(from) < 0) {
    throw new InvalidUpgradeError(from, toModel);
  }
  return toModel;
}

export async function upgradeMessage(
  deps: UpgradeMessageDeps,
  req: UpgradeMessageRequest,
  onToken: (delta: string) => void,
): Promise<UpgradeMessageResult> {
  const model = targetModel(req.fromModel, req.toModel);

  // Re-ask the same question: same history, minus the answer being replaced
  const ctx = await deps.context.prepare(req.chatId);
  const messages = ctx.messages.filter((m) => m.id !== req.replyMessageId);

  const { text, usage } = await deps.providers.streamReply({ model, messages, onToken });

  const reply = deps.db.saveMessage(ctx.chatId, 'assistant', text, {
    language: req.language,
    replyTo: req.userMessageId,
    category: req.category,
  });

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
