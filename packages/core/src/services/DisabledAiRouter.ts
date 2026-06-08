import type { TelegramInboundMessage } from "@telegram-bot-template/shared";
import type { AiRouter } from "../ports";

export class DisabledAiRouter implements AiRouter {
  isEnabled(): boolean {
    return false;
  }

  async suggestReply(_message: TelegramInboundMessage): Promise<string | null> {
    return null;
  }
}
