// Weekly stats handler. Pure on purpose: the Electron ipcMain.handle('stats:weekly', ...)
// registration and typed preload method are added at integration.
import type { UsageLogger } from '../usage/logger';
import { WEEK_MS, weeklyStats } from '../usage/weekly';
import type { WeeklyStats } from '../usage/types';

export function getWeeklyStats(logger: UsageLogger, now: number = Date.now()): WeeklyStats {
  return weeklyStats(logger.list(now - WEEK_MS, now), now);
}
