// Composition root: builds every dependency once and hands back what the IPC layer needs.
// No Electron imports, so the whole app logic can be exercised in tests with a fake provider.
import { createConfigStore } from './db/settings';
import { createMessageStore } from './db/messages';
import { createRoutingMemoryStore } from './db/routingMemory';
import type { Db } from './db';
import { createContext } from './context/summarizer';
import { getWeeklyStats } from './ipc/stats';
import type { SendMessageDeps } from './ipc/sendMessage';
import type { UpgradeMessageDeps } from './ipc/upgradeMessage';
import { createComplete, createStreamReply, type Complete, type StreamReply } from './providers/anthropic';
import { createClassifier } from './router/classifier';
import { createFeedback } from './router/feedback';
import { createRouter } from './router';
import { createSummaryLogger, createUsageDep } from './usage/adapter';
import { createUsageLogger } from './usage/logger';

export interface ComposeOptions {
  db: Db;
  getApiKey: () => string;
  // Test seams: replace the paid API calls
  complete?: Complete;
  streamReply?: StreamReply;
  now?: () => number;
  maxContextTokens?: number;
}

export function composeApp(opts: ComposeOptions) {
  const messages = createMessageStore(opts.db, opts.now);
  const logger = createUsageLogger(opts.db);
  const config = createConfigStore(opts.db);
  const feedback = createFeedback(createRoutingMemoryStore(opts.db));
  const complete = opts.complete ?? createComplete(opts.getApiKey);
  const streamReply = opts.streamReply ?? createStreamReply(opts.getApiKey);
  const usageOpts = { now: opts.now };

  const router = createRouter({
    classify: createClassifier(complete),
    isEnabled: () => config.get().routing.enabled,
    getOverrides: () => feedback.getOverrides(),
  });

  const context = createContext({
    messages,
    complete,
    isEnabled: () => config.get().languageSavings.autoSummarizeLongChats,
    onSummaryUsage: createSummaryLogger(logger, usageOpts),
    maxTokens: opts.maxContextTokens,
  });

  const chatDeps: SendMessageDeps & UpgradeMessageDeps = {
    db: messages,
    context,
    router,
    providers: { streamReply },
    usage: createUsageDep(logger, usageOpts),
    feedback,
  };

  return {
    chatDeps,
    logger,
    config,
    feedback,
    messages,
    // +1 because the stats window excludes its end, and a call logged this very millisecond counts
    getWeeklyStats: () => getWeeklyStats(logger, (opts.now ?? Date.now)() + 1),
  };
}
