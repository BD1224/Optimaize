// IPC handlers: sendMessage, upgradeMessage
import { ipcMain } from 'electron';
import {
  CHAT_SEND,
  CHAT_TOKEN,
  type SendMessageRequest,
  type SendMessageResult,
  type TokenEvent,
} from '../../shared/chat';
import { sendMessage, type SendMessageDeps } from './sendMessage';

export function registerChatHandlers(deps: SendMessageDeps): void {
  ipcMain.handle(CHAT_SEND, (event, req: SendMessageRequest): Promise<SendMessageResult> =>
    sendMessage(deps, req, (delta) => {
      const payload: TokenEvent = { chatId: req.chatId, delta };
      event.sender.send(CHAT_TOKEN, payload);
    }),
  );
}
