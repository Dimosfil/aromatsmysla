import type { TelegramInboundMessage } from "@telegram-bot-template/shared";
import type { AiPromptTemplate } from "../ports";

export const startReplyPrompt: AiPromptTemplate = {
  id: "start.reply.v1",
  render(message: TelegramInboundMessage): string {
    const name = message.username ?? "there";
    return `Write one short onboarding hint for ${name} after they start a business Telegram bot template.`;
  }
};
