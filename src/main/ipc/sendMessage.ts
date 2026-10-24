// The send-message pipeline. No Electron imports, so it can be tested directly.
import type {
  Category,
  ChatMessage,
  Difficulty,
  Role,
  SendMessageRequest,
  SendMessageResult,
  TokenUsage,
} from '../../shared/chat';

// What this pipeline expects from each folder under src/main/. The real logic lives
// in those folders; this is only the shape sendMessage() needs from each, passed in
// so tests can supply fakes instead of a real DB or the paid API.
export interface SendMessageDeps {
  db: {
    saveMessage(chatId: string, role: Role, content: string): ChatMessage;
  };
  context: {
    // Returns the messages to send to the model. If the chat was too long it is
    // summarized and a fresh chat is started; messages then seed from the summary.
    prepare(chatId: string): Promise<{ chatId: string; messages: ChatMessage[]; rolledOver: boolean }>;
  };
  router: {
    route(text: string): Promise<{
      model: string;
      category: Category;
      difficulty: Difficulty;
      // The classifier's own call, logged too so its cost shows up in the savings numbers
      classifier: { model: string; usage: TokenUsage };
    }>;
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
      // Ties the classifier call and the reply (and any later Upgrade) to one exchange
      messageId?: string;
      // Set when this call re-runs an earlier message on a bigger model
      parentMessageId?: string;
      isUpgrade?: boolean;
      language?: string;
    }): { costUsd: number };
  };
}

// Handles one user message from start to finish. It only calls the other folders in
// order; it contains no routing, summarizing, or pricing logic of its own.
// onToken is called for each streamed piece of the reply so the UI can show it live.
export async function sendMessage(
  deps: SendMessageDeps,
  req: SendMessageRequest,
  onToken: (delta: string) => void,
): Promise<SendMessageResult> {
  // 1. db: save the user's message first so it isn't lost if a later step fails
  const userMessage = deps.db.saveMessage(req.chatId, 'user', req.text);

  // 2. context: if the chat is too long, summarize it and continue in a fresh chat
  //    (ctx.chatId may differ from req.chatId after a rollover)
  const ctx = await deps.context.prepare(req.chatId);

  // 3. router: classify how hard the message is and pick the cheapest capable model
  const { model, category, difficulty, classifier } = await deps.router.route(req.text);

  // 4. providers: call the Claude API and stream the reply back through onToken
  const { text, usage } = await deps.providers.streamReply({
    model,
    messages: ctx.messages,
    onToken,
  });

  // 5. usage: log the tokens and cost (and what the largest model would have cost),
  //    for the classifier call too when it actually ran
  let costUsd = 0;
  if (classifier.usage.inputTokens + classifier.usage.outputTokens > 0) {
    costUsd += deps.usage.log({
      chatId: ctx.chatId,
      model: classifier.model,
      difficulty,
      kind: 'classifier',
      usage: classifier.usage,
      messageId: userMessage.id,
      language: req.language,
    }).costUsd;
  }
  costUsd += deps.usage.log({
    chatId: ctx.chatId,
    model,
    difficulty,
    kind: 'reply',
    usage,
    messageId: userMessage.id,
    language: req.language,
  }).costUsd;

  // 6. db: save the full reply, then return everything to the UI
  const reply = deps.db.saveMessage(ctx.chatId, 'assistant', text);

  return {
    userMessage,
    reply,
    model,
    difficulty,
    category,
    usage,
    costUsd,
    continuedInChatId: ctx.rolledOver ? ctx.chatId : undefined,
  };
}
