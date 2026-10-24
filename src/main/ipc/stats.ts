// Weekly stats handler. getWeeklyStats is pure; registerStatsHandler wires it to Electron.
import { STATS_WEEKLY } from '../../shared/app';
import type { UsageLogger } from '../usage/logger';
import { WEEK_MS, weeklyStats } from '../usage/weekly';
import type { WeeklyStats } from '../usage/types';
import type { IpcMainLike } from './settings';

export function getWeeklyStats(logger: UsageLogger, now: number = Date.now()): WeeklyStats {
  return weeklyStats(logger.list(now - WEEK_MS, now), now);
}

export function registerStatsHandler(ipcMain: IpcMainLike, logger: UsageLogger): void {
  ipcMain.handle(STATS_WEEKLY, () => getWeeklyStats(logger));
}
