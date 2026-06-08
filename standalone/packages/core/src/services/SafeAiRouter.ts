import type { TelegramInboundMessage } from "@telegram-bot-template/shared";
import type { AiRouter } from "../ports";

export class SafeAiRouter implements AiRouter {
  constructor(private readonly primary: AiRouter, private readonly fallback: AiRouter) {}

  isEnabled(): boolean {
    return this.primary.isEnabled();
  }

  async suggestReply(message: TelegramInboundMessage): Promise<string | null> {
    try {
      return await this.primary.suggestReply(message);
    } catch {
      return this.fallback.suggestReply(message);
    }
  }
}
