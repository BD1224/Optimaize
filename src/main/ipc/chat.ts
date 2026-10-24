// IPC handlers: sendMessage, upgradeMessage
import { ipcMain } from 'electron';
import {
  CHAT_SEND,
  CHAT_TOKEN,
  CHAT_UPGRADE,
  type SendMessageRequest,
  type SendMessageResult,
  type TokenEvent,
  type UpgradeMessageRequest,
  type UpgradeMessageResult,
} from '../../shared/chat';
import { sendMessage, type SendMessageDeps } from './sendMessage';
import { upgradeMessage, type UpgradeMessageDeps } from './upgradeMessage';

export function registerChatHandlers(deps: SendMessageDeps & UpgradeMessageDeps): void {
  const tokenSender = (event: Electron.IpcMainInvokeEvent, chatId: string) => (delta: string) => {
    const payload: TokenEvent = { chatId, delta };
    event.sender.send(CHAT_TOKEN, payload);
  };

  ipcMain.handle(CHAT_SEND, (event, req: SendMessageRequest): Promise<SendMessageResult> =>
    sendMessage(deps, req, tokenSender(event, req.chatId)),
  );

  ipcMain.handle(CHAT_UPGRADE, (event, req: UpgradeMessageRequest): Promise<UpgradeMessageResult> =>
    upgradeMessage(deps, req, tokenSender(event, req.chatId)),
  );
}
