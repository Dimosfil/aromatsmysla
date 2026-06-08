export interface UserSession {
  userId: string;
  chatId: string;
  username?: string;
  lastIntent: string;
  selectedGuideId?: string;
  subscriptionCheckedAt?: string;
  guideDeliveredAt?: string;
  updatedAt: string;
}

export interface GuideOffer {
  id: string;
  title: string;
  filePath: string;
  buttonPrefix?: string;
}

export type LeadStatus = "new" | "contacted" | "closed";

export interface LeadRequest {
  id: string;
  source: "telegram";
  status: LeadStatus;
  userId: string;
  chatId: string;
  username?: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsEvent {
  id: string;
  eventType: string;
  source: "telegram";
  userId: string;
  chatId: string;
  username?: string;
  guideId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
