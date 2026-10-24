// Electron main process entry: app startup and window creation.
import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import { join } from 'node:path';
import { composeApp } from './compose';
import { openDatabase } from './db';
import { registerChatHandlers } from './ipc/chat';
import { registerSettingsHandlers } from './ipc/settings';
import { registerStatsHandler } from './ipc/stats';
import { createCheckKey } from './providers/anthropic';
import { createKeystore } from './security/keystore';

// Injected by Electron Forge's webpack plugin; undefined when run any other way
declare const MAIN_WINDOW_WEBPACK_ENTRY: string | undefined;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string | undefined;

function startBackend() {
  const userData = app.getPath('userData');
  const db = openDatabase(join(userData, 'optimaize.sqlite'));

  const keystore = createKeystore(join(userData, 'api-key.bin'), {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (plain) => safeStorage.encryptString(plain),
    decrypt: (data) => safeStorage.decryptString(data),
  });

  const parts = composeApp({
    db,
    getApiKey: () => {
      const key = keystore.get();
      if (!key) throw new Error('No API key set. Add one in Settings.');
      return key;
    },
  });

  registerChatHandlers(parts.chatDeps);
  registerStatsHandler(ipcMain, parts.logger);
  registerSettingsHandlers(ipcMain, { keystore, config: parts.config, checkKey: createCheckKey() });
  return { db };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: typeof MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY === 'string' ? MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY : undefined,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (typeof MAIN_WINDOW_WEBPACK_ENTRY === 'string') void win.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  return win;
}

app.whenReady().then(() => {
  const { db } = startBackend();

  // Startup check used to verify the backend boots without opening a window
  if (process.env.OPTIMAIZE_SMOKE_TEST === '1') {
    console.log('SMOKE OK');
    db.close();
    app.quit();
    return;
  }

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
