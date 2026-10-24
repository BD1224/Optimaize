// Electron main process entry: app startup and window creation.
import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import { join } from 'node:path';
import { composeApp } from './compose';
import { openDatabase } from './db';
import { registerChatHandlers } from './ipc/chat';
import { registerSettingsHandlers } from './ipc/settings';
import { registerStatsHandler } from './ipc/stats';
import { createBackendApi, registerBackendApi } from './ipc/ui';
import { createCheckKey, createCountTokens } from './providers/anthropic';
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

  const getApiKey = () => {
    const key = keystore.get();
    if (!key) throw new Error('No API key set. Add one in Settings.');
    return key;
  };
  const parts = composeApp({ db, getApiKey });

  registerBackendApi(ipcMain, createBackendApi({ app: parts, keystore, countTokens: createCountTokens(getApiKey) }));
  registerChatHandlers(parts.chatDeps);
  registerStatsHandler(ipcMain, parts.logger);
  registerSettingsHandlers(ipcMain, { keystore, config: parts.config, checkKey: createCheckKey() });
  return { db };
}

function createWindow(show = true) {
  const win = new BrowserWindow({
    show,
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

async function runSmokeTest(db: ReturnType<typeof startBackend>['db']) {
  try {
    const win = createWindow(false);
    await new Promise<void>((resolve) => win.webContents.once('did-finish-load', () => resolve()));
    const result = await win.webContents.executeJavaScript(`(async () => {
      const models = await window.api.listModels();
      const profile = await window.api.getProfile();
      const chats = await window.api.listChats();
      const stats = await window.api.getStats(0);
      return JSON.stringify({ models: models.length, name: profile.name, chats: chats.length, tokens: stats.tokensWith, hasKey: await window.api.hasApiKey(), ui: document.body.innerText.trim().slice(0, 40) });
    })()`);
    console.log('SMOKE OK', result);
  } catch (err) {
    console.log('SMOKE FAILED', err);
    process.exitCode = 1;
  } finally {
    db.close();
    app.quit();
  }
}

app.whenReady().then(() => {
  const { db } = startBackend();

  // Startup check: load the real UI in a hidden window and call the backend through the preload bridge
  if (process.env.OPTIMAIZE_SMOKE_TEST === '1') {
    void runSmokeTest(db);
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
