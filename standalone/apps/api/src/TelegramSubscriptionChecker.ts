import type { SubscriptionChecker } from "@telegram-bot-template/core";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface TelegramChatMember {
  status: string;
}

export class TelegramSubscriptionChecker implements SubscriptionChecker {
  private token = "";

  constructor(
    private readonly channelId: string,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  configureToken(token: string): void {
    this.token = token.trim();
  }

  async isSubscribed(userId: string): Promise<boolean> {
    if (!this.token || !this.channelId) {
      return false;
    }

    const member = await this.callTelegram<TelegramChatMember>("getChatMember", {
      chat_id: this.channelId,
      user_id: userId
    });

    return ["creator", "administrator", "member"].includes(member.status);
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
}
