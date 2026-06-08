import type { TelegramInboundMessage } from "@telegram-bot-template/shared";
import type { AnalyticsEvent, LeadRequest, UserSession } from "./models";

export interface SessionRepository {
  findByUserId(userId: string): Promise<UserSession | null>;
  save(session: UserSession): Promise<void>;
}

export interface LeadRepository {
  create(lead: LeadRequest): Promise<void>;
  findById(id: string): Promise<LeadRequest | null>;
  listRecent(limit: number): Promise<LeadRequest[]>;
}

export interface AnalyticsRepository {
  record(event: AnalyticsEvent): Promise<void>;
}

export interface AiRouter {
  isEnabled(): boolean;
  suggestReply(message: TelegramInboundMessage): Promise<string | null>;
}

export interface AiPromptTemplate {
  id: string;
  render(message: TelegramInboundMessage): string;
}

export interface SubscriptionChecker {
  isSubscribed(userId: string): Promise<boolean>;
}
