import type { TelegramInboundMessage } from "@telegram-bot-template/shared";
import type { AiPromptTemplate, AiRouter } from "../ports";
import { startReplyPrompt } from "../prompts/startReplyPrompt";

export interface MockAiRouterOptions {
  prompt?: AiPromptTemplate;
}

export class MockAiRouter implements AiRouter {
  private readonly prompt: AiPromptTemplate;

  constructor(options: MockAiRouterOptions = {}) {
    this.prompt = options.prompt ?? startReplyPrompt;
  }

  isEnabled(): boolean {
    return true;
  }

  async suggestReply(message: TelegramInboundMessage): Promise<string | null> {
    const prompt = this.prompt.render(message);
    return `AI hint (${this.prompt.id}): ${summarizePrompt(prompt)}`;
  }
}

function summarizePrompt(prompt: string): string {
  return prompt.length > 96 ? `${prompt.slice(0, 93)}...` : prompt;
}
