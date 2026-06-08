import { existsSync, readFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import type { BotBusinessResponse, TelegramInboundMessage, TelegramBotConfigStatus } from "@telegram-bot-template/shared";
import { isValidTelegramToken, maskTelegramToken } from "./config";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: {
      id: number | string;
    };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    from: {
      id: number;
      username?: string;
      first_name?: string;
    };
    message?: {
      chat: {
        id: number | string;
      };
    };
  };
}

export interface TelegramPollingGatewayOptions {
  fetchFn?: typeof fetch;
  pollIntervalMs?: number;
  retryDelayMs?: number;
}

export class TelegramPollingGateway {
  private token = "";
  private tokenSource: TelegramBotConfigStatus["tokenSource"] = "none";
  private offset = 0;
  private polling = false;
  private lastError: string | null = null;
  private readonly fetchFn: typeof fetch;
  private readonly pollIntervalMs: number;
  private readonly retryDelayMs: number;

  constructor(
    private readonly handleMessage: (message: TelegramInboundMessage) => Promise<BotBusinessResponse>,
    options: TelegramPollingGatewayOptions = {}
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.pollIntervalMs = options.pollIntervalMs ?? 0;
    this.retryDelayMs = options.retryDelayMs ?? 3000;
  }

  configureToken(token: string, source: TelegramBotConfigStatus["tokenSource"] = "runtime"): TelegramBotConfigStatus {
    const normalized = token.trim();
    if (!isValidTelegramToken(normalized)) {
      throw new Error("Invalid Telegram bot token format.");
    }

    this.token = normalized;
    this.tokenSource = source;
    this.offset = 0;
    this.lastError = null;
    this.start();
    return this.getStatus();
  }

  getStatus(): TelegramBotConfigStatus {
    return {
      configured: Boolean(this.token),
      polling: this.polling,
      maskedToken: this.token ? maskTelegramToken(this.token) : null,
      lastError: this.lastError,
      tokenSource: this.tokenSource,
      restartPersistent: this.tokenSource === "env"
    };
  }

  start(): void {
    if (!this.token || this.polling) {
      return;
    }

    this.polling = true;
    void this.pollLoop();
  }

  stop(): void {
    this.polling = false;
  }

  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        const updates = await this.callTelegram<TelegramUpdate[]>("getUpdates", {
          offset: this.offset,
          timeout: 20,
          allowed_updates: ["message", "callback_query"]
        });

        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }

        if (this.polling && this.pollIntervalMs > 0) {
          await delay(this.pollIntervalMs);
        }
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        await delay(this.retryDelayMs);
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    const message = update.message;
    if (!message?.text) {
      return;
    }

    const response = await this.handleMessage({
      chatId: String(message.chat.id),
      userId: String(message.from?.id ?? message.chat.id),
      username: message.from?.username ?? message.from?.first_name,
      text: message.text
    });

    if (response.status === "ignored") {
      return;
    }

    await this.sendBusinessResponse(response);
  }

  private async handleCallbackQuery(callbackQuery: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
    if (!callbackQuery.data || !callbackQuery.message) {
      return;
    }

    const response = await this.handleMessage({
      chatId: String(callbackQuery.message.chat.id),
      userId: String(callbackQuery.from.id),
      username: callbackQuery.from.username ?? callbackQuery.from.first_name,
      text: callbackQuery.data,
      callbackData: callbackQuery.data
    });

    await this.callTelegram("answerCallbackQuery", {
      callback_query_id: callbackQuery.id
    });

    if (response.status === "ignored") {
      return;
    }

    await this.sendBusinessResponse(response);
  }

  private async sendBusinessResponse(response: BotBusinessResponse): Promise<void> {
    const photoPath = resolveTelegramFilePath(response.photoPath);
    if (photoPath) {
      await this.sendPhoto(response, photoPath);
    } else {
      await this.sendMessage(response);
    }

    if (response.documentPath) {
      await this.sendDocument(response.chatId, response.documentPath);
    }
  }

  private async sendMessage(response: BotBusinessResponse): Promise<void> {
    await this.callTelegram("sendMessage", {
      chat_id: response.chatId,
      text: response.text,
      disable_web_page_preview: false,
      reply_markup: this.createReplyMarkup(response)
    });
  }

  private async sendPhoto(response: BotBusinessResponse, photoPath: string): Promise<void> {
    const formData = new FormData();
    formData.append("chat_id", response.chatId);
    formData.append("photo", new Blob([readFileSync(photoPath)]), basename(photoPath));
    formData.append("caption", response.text);
    const replyMarkup = this.createReplyMarkup(response);
    if (replyMarkup) {
      formData.append("reply_markup", JSON.stringify(replyMarkup));
    }

    await this.callTelegramForm("sendPhoto", formData);
  }

  private async sendDocument(chatId: string, documentPath: string): Promise<void> {
    const resolvedDocumentPath = resolveTelegramFilePath(documentPath);
    if (!resolvedDocumentPath) {
      throw new Error(`Telegram document file not found: ${documentPath}`);
    }

    const formData = new FormData();
    formData.append("chat_id", chatId);
    formData.append("document", new Blob([readFileSync(resolvedDocumentPath)]), basename(resolvedDocumentPath));

    await this.callTelegramForm("sendDocument", formData);
  }

  private async callTelegram<T>(method: string, payload: unknown): Promise<T> {
    const response = await this.fetchFn(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || !body.ok) {
      throw new Error(body.description ?? `Telegram API ${method} failed with ${response.status}`);
    }

    return body.result as T;
  }

  private async callTelegramForm<T>(method: string, body: FormData): Promise<T> {
    const response = await this.fetchFn(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      body
    });

    const responseBody = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || !responseBody.ok) {
      throw new Error(responseBody.description ?? `Telegram API ${method} failed with ${response.status}`);
    }

    return responseBody.result as T;
  }

  private createReplyMarkup(response: BotBusinessResponse): { inline_keyboard: Array<Array<Record<string, string>>> } | undefined {
    if (!response.inlineKeyboard) {
      return undefined;
    }

    return {
      inline_keyboard: response.inlineKeyboard.map((row) =>
        row.map((button) => ({
          text: button.text,
          ...(button.callbackData ? { callback_data: button.callbackData } : {}),
          ...(button.url ? { url: button.url } : {})
        }))
      )
    };
  }
}

export function resolveTelegramFilePath(filePath: string | undefined): string | null {
  if (!filePath) {
    return null;
  }

  const normalizedPath = filePath.trim();
  if (!normalizedPath) {
    return null;
  }

  for (const candidate of getTelegramFilePathCandidates(normalizedPath)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getTelegramFilePathCandidates(filePath: string): string[] {
  const relativePath = toRelativeAppPath(filePath);
  const candidates = [
    filePath,
    relativePath,
    `bot/${relativePath}`,
    `../${relativePath}`,
    `../bot/${relativePath}`,
    `/app/${relativePath}`,
    `/app/bot/${relativePath}`
  ];

  return [
    ...new Set(
      candidates.map((candidate) => resolve(candidate))
    )
  ];
}

function toRelativeAppPath(filePath: string): string {
  const resolvedPath = resolve(filePath);
  const appBotRelative = relative("/app/bot", resolvedPath);
  if (appBotRelative && !appBotRelative.startsWith("..") && appBotRelative !== ".") {
    return appBotRelative.split(sep).join("/");
  }

  const appRelative = relative("/app", resolvedPath);
  if (appRelative && !appRelative.startsWith("..") && appRelative !== ".") {
    return appRelative.split(sep).join("/");
  }

  return filePath.replace(/^[a-zA-Z]:[\\/]/, "").replace(/^[/\\]+/, "").split(/[\\/]+/).join("/");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
