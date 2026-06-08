import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ApiConfig {
  host: string;
  port: number;
  telegramBotToken: string | null;
  telegramPollingEnabled: boolean;
  guideBot: GuideBotRuntimeConfig | null;
  sqliteIndexPath: string;
  sqliteSessionPath: string;
  aiProvider: string;
  aiApiKey: string | null;
  appEnv: string;
  logLevel: string;
  adminUsername: string;
  adminPassword: string;
  guideBotContentPath: string;
  guideBotUploadDir: string;
  adminWebDir: string | null;
}

export interface GuideBotRuntimeConfig {
  requiredChannelId: string;
  requiredChannelUrl?: string;
  selectionPhotoPath?: string;
  guides: GuideRuntimeConfig[];
  copy: GuideBotCopyConfig;
  media?: GuideBotMediaConfig;
}

export interface GuideRuntimeConfig {
  id: string;
  title: string;
  filePath: string;
  buttonPrefix?: string;
}

export interface GuideBotCopyConfig {
  welcomePrompt: string;
  subscribePrompt: string;
  subscribedPrompt: string;
  deliveredPrefix: string;
  unavailableGuide: string;
  subscriptionCheckError: string;
  checkSubscriptionButton: string;
  channelButtonText: string;
}

export interface GuideBotMediaConfig {
  welcomePhotoPath?: string;
  subscribePhotoPath?: string;
  subscriptionCheckErrorPhotoPath?: string;
  unavailableGuidePhotoPath?: string;
  deliveredPhotoPath?: string;
}

export interface LoadApiConfigOptions {
  env?: NodeJS.ProcessEnv;
  envFilePath?: string;
  loadEnvFile?: boolean;
}

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid API configuration:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

export function loadApiConfig(options: LoadApiConfigOptions = {}): ApiConfig {
  const env = mergeEnv(options);
  const config: ApiConfig = {
    host: readString(env.API_HOST, "127.0.0.1"),
    port: readPort(env.API_PORT, 3000),
    telegramBotToken: readOptionalString(env.TELEGRAM_BOT_TOKEN),
    telegramPollingEnabled: readBoolean(env.TELEGRAM_POLLING_ENABLED, false),
    guideBot: readGuideBotConfig(env),
    sqliteIndexPath: readString(env.SQLITE_INDEX_PATH, "storage/index.sqlite3"),
    sqliteSessionPath: readString(env.SQLITE_SESSION_PATH, "data/sessions.sqlite3"),
    aiProvider: readString(env.AI_PROVIDER, "disabled").toLowerCase(),
    aiApiKey: readOptionalString(env.AI_API_KEY),
    appEnv: readString(env.APP_ENV, "local"),
    logLevel: readString(env.LOG_LEVEL, "info"),
    adminUsername: readString(env.ADMIN_USERNAME, "admin"),
    adminPassword: readString(env.ADMIN_PASSWORD, "admin"),
    guideBotContentPath: readString(env.GUIDE_BOT_CONTENT_PATH, "data/guide-bot-content.json"),
    guideBotUploadDir: readString(env.GUIDE_BOT_UPLOAD_DIR, "data/guide-bot-uploads"),
    adminWebDir: readOptionalString(env.ADMIN_WEB_DIR)
  };

  validateConfig(config);
  return config;
}

function readGuideBotConfig(env: NodeJS.ProcessEnv): GuideBotRuntimeConfig | null {
  const requiredChannelId = readOptionalString(env.GUIDE_BOT_REQUIRED_CHANNEL_ID);
  const guides = readGuideConfigs(env);
  if (!requiredChannelId && guides.length === 0) {
    return null;
  }

  return {
    requiredChannelId: requiredChannelId ?? "",
    requiredChannelUrl: readOptionalString(env.GUIDE_BOT_REQUIRED_CHANNEL_URL) ?? undefined,
    selectionPhotoPath: readOptionalString(env.GUIDE_BOT_SELECTION_PHOTO_PATH) ?? undefined,
    guides,
    copy: readGuideBotCopyConfig(env)
  };
}

function readGuideBotCopyConfig(env: NodeJS.ProcessEnv): GuideBotCopyConfig {
  return {
    welcomePrompt: readString(env.GUIDE_BOT_COPY_WELCOME_PROMPT, "Great, subscription confirmed. Choose the guide you want:"),
    subscribePrompt: readString(env.GUIDE_BOT_COPY_SUBSCRIBE_PROMPT, "Hi! Subscribe to the channel first, then send /start again."),
    subscribedPrompt: readString(env.GUIDE_BOT_COPY_SUBSCRIBED_PROMPT, "Great, subscription confirmed. Choose the guide you want:"),
    deliveredPrefix: readString(env.GUIDE_BOT_COPY_DELIVERED_PREFIX, "Here is your guide:"),
    unavailableGuide: readString(env.GUIDE_BOT_COPY_UNAVAILABLE_GUIDE, "This guide is not configured anymore. Send /start and choose an available option."),
    subscriptionCheckError: readString(env.GUIDE_BOT_COPY_SUBSCRIPTION_CHECK_ERROR, "I cannot verify your channel subscription yet. Please try again later."),
    checkSubscriptionButton: readString(env.GUIDE_BOT_COPY_CHECK_SUBSCRIPTION_BUTTON, "Subscription confirmed"),
    channelButtonText: readString(env.GUIDE_BOT_COPY_CHANNEL_BUTTON_TEXT, "Open channel")
  };
}

function readGuideConfigs(env: NodeJS.ProcessEnv): GuideRuntimeConfig[] {
  const guides: GuideRuntimeConfig[] = [];
  for (let index = 1; index <= 20; index += 1) {
    const prefix = `GUIDE_BOT_GUIDE_${index}`;
    const id = readOptionalString(env[`${prefix}_ID`]);
    const title = readOptionalString(env[`${prefix}_TITLE`]);
    const filePath = readOptionalString(env[`${prefix}_FILE_PATH`]);
    const buttonPrefix = readOptionalString(env[`${prefix}_BUTTON_PREFIX`]) ?? undefined;
    if (!id && !title && !filePath) {
      continue;
    }

    guides.push({
      id: id ?? "",
      title: title ?? "",
      filePath: filePath ?? "",
      buttonPrefix
    });
  }
  return guides;
}

function mergeEnv(options: LoadApiConfigOptions): NodeJS.ProcessEnv {
  const env = options.env ?? process.env;
  if (options.loadEnvFile === false) {
    return { ...env };
  }

  return {
    ...readDotEnvFile(options.envFilePath ?? readOptionalString(env.API_ENV_FILE) ?? ".env"),
    ...env
  };
}

function readDotEnvFile(path: string): NodeJS.ProcessEnv {
  const resolvedPath = resolve(path);
  if (!existsSync(resolvedPath)) {
    return {};
  }

  const values: NodeJS.ProcessEnv = {};
  for (const line of readFileSync(resolvedPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values[key] = unquoteEnvValue(value);
  }

  return values;
}

function unquoteEnvValue(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  return value.replace(/\\n/g, "\n");
}

function readString(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function readOptionalString(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || normalized === "replace-with-token") {
    return null;
  }

  return normalized;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function readPort(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return Number(value);
}

function validateConfig(config: ApiConfig): void {
  const issues: string[] = [];

  if (!config.host) {
    issues.push("API_HOST must not be empty.");
  }

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    issues.push("API_PORT must be an integer between 1 and 65535.");
  }

  if (!config.sqliteSessionPath) {
    issues.push("SQLITE_SESSION_PATH must not be empty.");
  }

  if (!config.sqliteIndexPath) {
    issues.push("SQLITE_INDEX_PATH must not be empty.");
  }

  if (!config.aiProvider) {
    issues.push("AI_PROVIDER must not be empty. Use \"disabled\" when AI is not configured.");
  }

  if (!config.adminUsername) {
    issues.push("ADMIN_USERNAME must not be empty.");
  }

  if (!config.adminPassword) {
    issues.push("ADMIN_PASSWORD must not be empty.");
  }

  if (!config.guideBotContentPath) {
    issues.push("GUIDE_BOT_CONTENT_PATH must not be empty.");
  }

  if (!config.guideBotUploadDir) {
    issues.push("GUIDE_BOT_UPLOAD_DIR must not be empty.");
  }

  if (!["disabled", "mock"].includes(config.aiProvider)) {
    issues.push("AI_PROVIDER must be one of: disabled, mock.");
  }

  if (config.telegramBotToken && !isValidTelegramToken(config.telegramBotToken)) {
    issues.push("TELEGRAM_BOT_TOKEN must look like 123456789:AA... and must not be committed.");
  }

  if (config.telegramPollingEnabled && !config.telegramBotToken) {
    issues.push("TELEGRAM_POLLING_ENABLED=true requires TELEGRAM_BOT_TOKEN.");
  }

  if (config.guideBot) {
    if (!config.guideBot.requiredChannelId) {
      issues.push("GUIDE_BOT_REQUIRED_CHANNEL_ID must be set when guide bot values are configured.");
    }

    if (config.guideBot.guides.length === 0) {
      issues.push("At least one GUIDE_BOT_GUIDE_N_* entry must be set when GUIDE_BOT_REQUIRED_CHANNEL_ID is configured.");
    }

    for (const [index, guide] of config.guideBot.guides.entries()) {
      const prefix = `GUIDE_BOT_GUIDE_${index + 1}`;
      if (!guide.id) {
        issues.push(`${prefix}_ID must not be empty.`);
      }
      if (!guide.title) {
        issues.push(`${prefix}_TITLE must not be empty.`);
      }
      if (!guide.filePath) {
        issues.push(`${prefix}_FILE_PATH must not be empty.`);
      }
    }
  }

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }
}

export function isValidTelegramToken(token: string): boolean {
  const [botId, secret] = token.split(":");
  return Boolean(botId && secret && /^\d+$/.test(botId) && secret.length >= 20);
}

export function maskTelegramToken(token: string): string {
  const [botId, secret = ""] = token.split(":");
  return `${botId}:********${secret.slice(-4)}`;
}
