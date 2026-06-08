export type ServiceStatus = "ok" | "degraded" | "down";

export interface HealthResponse {
  status: ServiceStatus;
  service: string;
}

export interface TelegramInboundMessage {
  chatId: string;
  userId: string;
  text: string;
  username?: string;
  callbackData?: string;
}

export interface BotInlineButton {
  text: string;
  callbackData?: string;
  url?: string;
}

export interface BotBusinessResponse {
  chatId: string;
  text: string;
  status: "handled" | "ignored";
  inlineKeyboard?: BotInlineButton[][];
  documentPath?: string;
  documentTelegramFileId?: string;
  documentTelegramMessageLink?: string;
  photoPath?: string;
}

export type LeadStatus = "new" | "contacted" | "closed";

export interface LeadDto {
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

export interface LeadListResponse {
  leads: LeadDto[];
}

export interface LeadDetailResponse {
  found: boolean;
  lead: LeadDto | null;
}

export interface TelegramBotConfigRequest {
  token: string;
}

export interface TelegramBotConfigStatus {
  configured: boolean;
  polling: boolean;
  maskedToken: string | null;
  lastError: string | null;
  tokenSource: "none" | "runtime" | "env";
  restartPersistent: boolean;
}

export interface TelegramDiagnosticCase {
  command: string;
  status: BotBusinessResponse["status"];
  text: string;
}

export interface TelegramDiagnosticsResponse {
  config: TelegramBotConfigStatus;
  cases: TelegramDiagnosticCase[];
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  username: string;
}

export interface GuideBotAdminGuide {
  id: string;
  title: string;
  filePath: string;
  telegramFileId?: string;
  telegramMessageLink?: string;
  buttonPrefix?: string;
}

export interface GuideBotAdminMessages {
  welcomePrompt: string;
  subscribePrompt: string;
  subscribedPrompt: string;
  deliveredPrefix: string;
  unavailableGuide: string;
  subscriptionCheckError: string;
  checkSubscriptionButton: string;
  channelButtonText: string;
}

export interface GuideBotAdminMedia {
  welcomePhotoPath?: string;
  subscribePhotoPath?: string;
  subscriptionCheckErrorPhotoPath?: string;
  unavailableGuidePhotoPath?: string;
  deliveredPhotoPath?: string;
}

export interface GuideBotAdminContent {
  requiredChannelUrl?: string;
  selectionPhotoPath?: string;
  messages: GuideBotAdminMessages;
  media: GuideBotAdminMedia;
  guides: GuideBotAdminGuide[];
}

export interface AdminUploadResponse {
  filePath: string;
  fileName: string;
}

export interface AdminStatsOverview {
  totalUsers: number;
  totalEvents: number;
  starts: number;
  subscriptionChecks: number;
  subscriptionVerified: number;
  guideClicks: number;
  guideDelivered: number;
  errors: number;
}

export interface AdminStatsDailyPoint {
  date: string;
  newUsers: number;
  events: number;
}

export interface AdminStatsFunnelStep {
  id: string;
  label: string;
  count: number;
}

export interface AdminStatsEventDto {
  id: string;
  eventType: string;
  userId: string;
  chatId: string;
  username?: string;
  guideId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminStatsResponse {
  overview: AdminStatsOverview;
  daily: AdminStatsDailyPoint[];
  funnel: AdminStatsFunnelStep[];
  recentEvents: AdminStatsEventDto[];
  recentErrors: AdminStatsEventDto[];
}

export function isStartCommand(message: TelegramInboundMessage): boolean {
  return message.text.trim().toLowerCase().startsWith("/start");
}

export function isOzonCommand(message: TelegramInboundMessage): boolean {
  return message.text.trim().toLowerCase().startsWith("/ozon");
}

export function isLeadCommand(message: TelegramInboundMessage): boolean {
  return message.text.trim().toLowerCase().startsWith("/lead");
}
