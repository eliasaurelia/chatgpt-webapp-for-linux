import { join } from 'node:path';
import type { SaveDialogOptions, SaveDialogReturnValue } from 'electron';

import {
  CHAT_EXPORT_EXTENSIONS,
  createChatExportFileName,
  formatChatExport,
  isChatExportFormat,
  type ChatExportFormat,
  type ChatExportPayload,
} from '../shared/chat-export.ts';

export interface ChatExportRequest {
  format: ChatExportFormat;
  payload: ChatExportPayload;
}

export type ChatExportSaveResult =
  | { ok: true; filePath: string }
  | { ok: false; canceled: true };

export interface ChatExportServiceDependencies {
  showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
  writeFile(path: string, content: string): Promise<void>;
  defaultDirectory?: string;
  now?: () => Date;
}

export interface ChatExportService {
  saveChatExport(request: ChatExportRequest): Promise<ChatExportSaveResult>;
}

const FORMAT_NAMES: Record<ChatExportFormat, string> = {
  markdown: 'Markdown',
  html: 'HTML',
  json: 'JSON',
  txt: 'Plain Text',
};

export function createChatExportService(dependencies: ChatExportServiceDependencies): ChatExportService {
  const now = dependencies.now ?? (() => new Date());

  return {
    async saveChatExport(request: ChatExportRequest): Promise<ChatExportSaveResult> {
      if (!isChatExportFormat(request.format)) {
        throw new Error(`Unsupported export format: ${String(request.format)}`);
      }

      const defaultFileName = createChatExportFileName(
        request.payload.title,
        request.format,
        now(),
      );
      const extension = CHAT_EXPORT_EXTENSIONS[request.format];
      const defaultPath = dependencies.defaultDirectory
        ? join(dependencies.defaultDirectory, defaultFileName)
        : defaultFileName;

      const result = await dependencies.showSaveDialog({
        title: 'Export ChatGPT conversation',
        defaultPath,
        buttonLabel: 'Export',
        filters: [
          {
            name: FORMAT_NAMES[request.format],
            extensions: [extension],
          },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }

      await dependencies.writeFile(
        result.filePath,
        formatChatExport(request.payload, request.format),
      );

      return { ok: true, filePath: result.filePath };
    },
  };
}
