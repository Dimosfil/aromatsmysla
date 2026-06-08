import type { BotBusinessResponse, BotInlineButton, TelegramInboundMessage } from "@telegram-bot-template/shared";
import { isLeadCommand, isOzonCommand, isStartCommand } from "@telegram-bot-template/shared";
import type { GuideOffer } from "../models";
import type { AiRouter, AnalyticsRepository, LeadRepository, SessionRepository, SubscriptionChecker } from "../ports";

export interface BusinessBotServiceDependencies {
  sessions: SessionRepository;
  leads?: LeadRepository;
  analytics?: AnalyticsRepository;
  aiRouter: AiRouter;
  guideBot?: GuideBotConfig;
}

export interface GuideBotConfig {
  requiredChannelUrl?: string;
  selectionPhotoPath?: string;
  guides: GuideOffer[];
  subscriptionChecker: SubscriptionChecker;
  copy?: GuideBotCopy;
  media?: GuideBotMedia;
}

export interface GuideBotCopy {
  welcomePrompt?: string;
  subscribePrompt?: string;
  subscribedPrompt?: string;
  deliveredPrefix?: string;
  unavailableGuide?: string;
  subscriptionCheckError?: string;
  checkSubscriptionButton?: string;
  channelButtonText?: string;
}

export interface GuideBotMedia {
  welcomePhotoPath?: string;
  subscribePhotoPath?: string;
  subscriptionCheckErrorPhotoPath?: string;
  unavailableGuidePhotoPath?: string;
  deliveredPhotoPath?: string;
}

export class BusinessBotService {
  constructor(private readonly dependencies: BusinessBotServiceDependencies) {}

  async handleInboundMessage(message: TelegramInboundMessage): Promise<BotBusinessResponse> {
    if (this.dependencies.guideBot && message.callbackData === "guide:check_subscription") {
      return this.handleGuideSubscriptionCheck(message);
    }

    if (this.dependencies.guideBot && message.callbackData?.startsWith("guide:")) {
      return this.handleGuideChoice(message, message.callbackData.slice("guide:".length));
    }

    if (isOzonCommand(message)) {
      return {
        chatId: message.chatId,
        text: "Ozon: https://www.ozon.ru/",
        status: "handled"
      };
    }

    if (isLeadCommand(message)) {
      return this.handleLeadCommand(message);
    }

    if (!isStartCommand(message)) {
      return {
        chatId: message.chatId,
        text: "Command is not implemented yet.",
        status: "ignored"
      };
    }

    if (this.dependencies.guideBot) {
      return this.handleGuideStart(message);
    }

    const existing = await this.dependencies.sessions.findByUserId(message.userId);
    const intent = existing ? "start:returning" : "start:new";
    await this.dependencies.sessions.save({
      userId: message.userId,
      chatId: message.chatId,
      username: message.username,
      lastIntent: intent,
      updatedAt: new Date().toISOString()
    });

    const aiHint = await this.dependencies.aiRouter.suggestReply(message);
    const name = message.username ?? "there";
    return {
      chatId: message.chatId,
      text: `Hello, ${name}. The business bot template is ready.${aiHint ? ` ${aiHint}` : ""}`,
      status: "handled"
    };
  }

  private async handleGuideStart(message: TelegramInboundMessage): Promise<BotBusinessResponse> {
    await this.recordAnalytics("guide_start", message);
    const existing = await this.dependencies.sessions.findByUserId(message.userId);
    const intent = existing ? "guide:start:returning" : "guide:start:new";
    await this.dependencies.sessions.save({
      userId: message.userId,
      chatId: message.chatId,
      username: message.username,
      lastIntent: intent,
      updatedAt: new Date().toISOString()
    });

    return {
      chatId: message.chatId,
      text: this.getGuideCopy("welcomePrompt", this.getGuideCopy("subscribedPrompt", "Great, subscription confirmed. Choose the guide you want:")),
      status: "handled",
      photoPath: this.getGuideMedia("welcomePhotoPath"),
      inlineKeyboard: [
        [
          {
            text: this.getGuideCopy("checkSubscriptionButton", "Subscription confirmed"),
            callbackData: "guide:check_subscription"
          }
        ]
      ]
    };
  }

  private async handleGuideSubscriptionCheck(message: TelegramInboundMessage): Promise<BotBusinessResponse> {
    await this.recordAnalytics("guide_subscription_check_clicked", message);
    const subscription = await this.checkGuideSubscription(message.userId);
    if (subscription.error) {
      await this.recordAnalytics("guide_subscription_check_error", message, {
        error: subscription.error
      });
      return this.createSubscriptionCheckErrorResponse(message.chatId);
    }

    const subscribed = subscription.subscribed;
    if (!subscribed) {
      await this.recordAnalytics("guide_subscription_missing", message);
      const channelLine = this.dependencies.guideBot!.requiredChannelUrl
        ? `\n\nSubscribe here: ${this.dependencies.guideBot!.requiredChannelUrl}`
        : "";
      return {
        chatId: message.chatId,
        text: `${this.getGuideCopy("subscribePrompt", "Hi! Subscribe to the channel first, then send /start again.")}${channelLine}`,
        status: "handled",
        photoPath: this.getGuideMedia("subscribePhotoPath")
      };
    }

    await this.recordAnalytics("guide_subscription_verified", message);
    return this.createGuideSelectionResponse(message.chatId);
  }

  private async handleGuideChoice(message: TelegramInboundMessage, guideId: string): Promise<BotBusinessResponse> {
    await this.recordAnalytics("guide_clicked", message, { guideId }, guideId);
    const guide = this.dependencies.guideBot!.guides.find((item) => item.id === guideId);
    if (!guide) {
      await this.recordAnalytics("guide_unavailable", message, { guideId }, guideId);
      return {
        chatId: message.chatId,
        text: this.getGuideCopy("unavailableGuide", "This guide is not configured anymore. Send /start and choose an available option."),
        status: "handled",
        photoPath: this.getGuideMedia("unavailableGuidePhotoPath")
      };
    }

    const subscription = await this.checkGuideSubscription(message.userId);
    if (subscription.error) {
      await this.recordAnalytics("guide_subscription_check_error", message, {
        error: subscription.error,
        guideId
      }, guideId);
      return this.createSubscriptionCheckErrorResponse(message.chatId);
    }

    const subscribed = subscription.subscribed;
    if (!subscribed) {
      await this.recordAnalytics("guide_subscription_missing", message, { guideId }, guideId);
      const channelLine = this.dependencies.guideBot!.requiredChannelUrl
        ? `\n\nSubscribe here: ${this.dependencies.guideBot!.requiredChannelUrl}`
        : "";
      return {
        chatId: message.chatId,
        text: `I can send the guide after you subscribe to the channel.${channelLine}`,
        status: "handled"
      };
    }

    const now = new Date().toISOString();
    await this.dependencies.sessions.save({
      userId: message.userId,
      chatId: message.chatId,
      username: message.username,
      lastIntent: "guide:delivered",
      selectedGuideId: guide.id,
      subscriptionCheckedAt: now,
      guideDeliveredAt: now,
      updatedAt: now
    });

    await this.recordAnalytics("guide_delivered", message, { guideTitle: guide.title }, guide.id);
    return {
      chatId: message.chatId,
      text: `${this.getGuideCopy("deliveredPrefix", "Here is your guide:")} ${guide.title}`,
      status: "handled",
      photoPath: this.getGuideMedia("deliveredPhotoPath"),
      documentPath: guide.filePath,
      documentTelegramFileId: guide.telegramFileId,
      documentTelegramMessageLink: guide.telegramMessageLink
    };
  }

  private createGuideSelectionResponse(chatId: string): BotBusinessResponse {
    return {
      chatId,
      text: this.getGuideCopy("subscribedPrompt", "Great, subscription confirmed. Choose the guide you want:"),
      status: "handled",
      photoPath: this.dependencies.guideBot!.selectionPhotoPath,
      inlineKeyboard: this.createGuideSelectionKeyboard()
    };
  }

  private createGuideSelectionKeyboard(): BotBusinessResponse["inlineKeyboard"] {
    const guideBot = this.dependencies.guideBot!;
    const keyboard: BotInlineButton[][] = guideBot.guides.map((guide) => [
      {
        text: `${guide.buttonPrefix ? `${guide.buttonPrefix} ` : ""}${guide.title}`,
        callbackData: `guide:${guide.id}`
      }
    ]);

    if (guideBot.requiredChannelUrl) {
      keyboard.push([
        {
          text: this.getGuideCopy("channelButtonText", "Open channel"),
          url: guideBot.requiredChannelUrl
        }
      ]);
    }

    return keyboard;
  }

  private async checkGuideSubscription(userId: string): Promise<{ subscribed: boolean; error?: string }> {
    try {
      return {
        subscribed: await this.dependencies.guideBot!.subscriptionChecker.isSubscribed(userId)
      };
    } catch (error) {
      return {
        subscribed: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private createSubscriptionCheckErrorResponse(chatId: string): BotBusinessResponse {
    const channelLine = this.dependencies.guideBot!.requiredChannelUrl
      ? `\n\nChannel: ${this.dependencies.guideBot!.requiredChannelUrl}`
      : "";

    return {
      chatId,
      text: `${this.getGuideCopy("subscriptionCheckError", "I cannot verify your channel subscription yet. Please try again later.")}${channelLine}`,
      status: "handled",
      photoPath: this.getGuideMedia("subscriptionCheckErrorPhotoPath")
    };
  }

  private getGuideCopy(key: keyof GuideBotCopy, fallback: string): string {
    return this.dependencies.guideBot?.copy?.[key] ?? fallback;
  }

  private getGuideMedia(key: keyof GuideBotMedia): string | undefined {
    return this.dependencies.guideBot?.media?.[key];
  }

  private async recordAnalytics(
    eventType: string,
    message: TelegramInboundMessage,
    metadata?: Record<string, unknown>,
    guideId?: string
  ): Promise<void> {
    if (!this.dependencies.analytics) {
      return;
    }

    try {
      await this.dependencies.analytics.record({
        id: createAnalyticsEventId(),
        eventType,
        source: "telegram",
        userId: message.userId,
        chatId: message.chatId,
        username: message.username,
        guideId,
        metadata,
        createdAt: new Date().toISOString()
      });
    } catch {
      // Analytics must not block the user-facing bot flow.
    }
  }

  private async handleLeadCommand(message: TelegramInboundMessage): Promise<BotBusinessResponse> {
    const leadText = message.text.trim().replace(/^\/lead(?:@\w+)?/i, "").trim();

    if (!leadText) {
      return {
        chatId: message.chatId,
        text: "Send /lead followed by the request details, for example: /lead Need a demo this week.",
        status: "handled"
      };
    }

    if (!this.dependencies.leads) {
      return {
        chatId: message.chatId,
        text: "Lead capture is not configured yet.",
        status: "handled"
      };
    }

    const now = new Date().toISOString();
    const leadId = `lead_${now.replace(/\D/g, "")}_${Math.random().toString(36).slice(2, 8)}`;
    await this.dependencies.leads.create({
      id: leadId,
      source: "telegram",
      status: "new",
      userId: message.userId,
      chatId: message.chatId,
      username: message.username,
      text: leadText,
      createdAt: now,
      updatedAt: now
    });

    return {
      chatId: message.chatId,
      text: `Lead captured (${leadId}). Thanks, we will follow up.`,
      status: "handled"
    };
  }
}

function createAnalyticsEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
