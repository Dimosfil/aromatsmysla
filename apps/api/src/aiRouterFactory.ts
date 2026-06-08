import { DisabledAiRouter, MockAiRouter, SafeAiRouter, type AiRouter } from "@telegram-bot-template/core";
import type { ApiConfig } from "./config";

export function createAiRouter(config: ApiConfig): AiRouter {
  const fallback = new DisabledAiRouter();

  if (config.aiProvider === "disabled") {
    return fallback;
  }

  if (config.aiProvider === "mock") {
    return new SafeAiRouter(new MockAiRouter(), fallback);
  }

  return fallback;
}
