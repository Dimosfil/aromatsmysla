import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import type { GuideBotAdminContent, GuideBotAdminGuide } from "@telegram-bot-template/shared";
import type { GuideBotRuntimeConfig } from "./config";

const allowedUploadExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

export class GuideBotAdminContentStore {
  constructor(
    private readonly contentPath: string,
    private readonly uploadDir: string,
    private readonly seedPath: string | null = null
  ) {}

  read(baseConfig: GuideBotRuntimeConfig | null): GuideBotAdminContent {
    const baseContent = createContentFromRuntimeConfig(baseConfig);
    const seedContent = this.readSeedContent();
    const savedContent = this.readContentFile(this.contentPath);
    const sourceContent = savedContent && !isPlaceholderContent(savedContent, baseContent) ? savedContent : seedContent ?? savedContent;
    if (!sourceContent) {
      return baseContent;
    }

    return normalizeAdminContent({
      requiredChannelUrl: sourceContent.requiredChannelUrl ?? baseContent.requiredChannelUrl,
      selectionPhotoPath: sourceContent.selectionPhotoPath ?? baseContent.selectionPhotoPath,
      messages: {
        ...baseContent.messages,
        ...sourceContent.messages
      },
      media: {
        ...baseContent.media,
        ...sourceContent.media
      },
      guides: sourceContent.guides?.length ? sourceContent.guides : baseContent.guides
    });
  }

  write(content: GuideBotAdminContent): GuideBotAdminContent {
    const normalized = normalizeAdminContent(content);
    mkdirSync(resolve(this.contentPath, ".."), { recursive: true });
    writeFileSync(this.contentPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  writeUpload(fileName: string, body: Buffer): string {
    const safeName = createSafeUploadName(fileName);
    mkdirSync(this.uploadDir, { recursive: true });
    const filePath = resolve(this.uploadDir, safeName);
    writeFileSync(filePath, body);
    return filePath;
  }

  private readSeedContent(): Partial<GuideBotAdminContent> | null {
    for (const path of this.getSeedPathCandidates()) {
      const content = this.readContentFile(path);
      if (content) {
        return content;
      }
    }

    return null;
  }

  private readContentFile(path: string): Partial<GuideBotAdminContent> | null {
    if (!existsSync(path)) {
      return null;
    }

    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<GuideBotAdminContent>;
    return parsed && typeof parsed === "object" ? parsed : null;
  }

  private getSeedPathCandidates(): string[] {
    const candidates = [
      this.seedPath,
      "content.seed.json",
      "bot/content.seed.json",
      "../content.seed.json",
      "../bot/content.seed.json",
      this.seedPath ? resolve(dirname(dirname(this.seedPath)), "content.seed.json") : null
    ].filter((path): path is string => Boolean(path));

    return [...new Set(candidates.map((path) => resolve(path)))];
  }
}

export function createContentFromRuntimeConfig(config: GuideBotRuntimeConfig | null): GuideBotAdminContent {
  return normalizeAdminContent({
    requiredChannelUrl: config?.requiredChannelUrl,
    selectionPhotoPath: config?.selectionPhotoPath,
    messages: {
      welcomePrompt: config?.copy.welcomePrompt ?? "",
      subscribePrompt: config?.copy.subscribePrompt ?? "",
      subscribedPrompt: config?.copy.subscribedPrompt ?? "",
      deliveredPrefix: config?.copy.deliveredPrefix ?? "",
      unavailableGuide: config?.copy.unavailableGuide ?? "",
      subscriptionCheckError: config?.copy.subscriptionCheckError ?? "",
      checkSubscriptionButton: config?.copy.checkSubscriptionButton ?? "",
      channelButtonText: config?.copy.channelButtonText ?? ""
    },
    media: {
      welcomePhotoPath: config?.media?.welcomePhotoPath,
      subscribePhotoPath: config?.media?.subscribePhotoPath,
      subscriptionCheckErrorPhotoPath: config?.media?.subscriptionCheckErrorPhotoPath,
      unavailableGuidePhotoPath: config?.media?.unavailableGuidePhotoPath,
      deliveredPhotoPath: config?.media?.deliveredPhotoPath
    },
    guides: config?.guides ?? []
  });
}

export function applyAdminContentToRuntimeConfig(
  config: GuideBotRuntimeConfig | null,
  content: GuideBotAdminContent
): GuideBotRuntimeConfig | null {
  if (!config) {
    return null;
  }

  const normalized = normalizeAdminContent(content);
  config.requiredChannelUrl = normalized.requiredChannelUrl;
  config.selectionPhotoPath = normalized.selectionPhotoPath;
  config.copy = normalized.messages;
  config.media = normalized.media;
  config.guides = normalized.guides;
  return config;
}

function normalizeAdminContent(content: GuideBotAdminContent): GuideBotAdminContent {
  return {
    requiredChannelUrl: normalizeOptionalString(content.requiredChannelUrl),
    selectionPhotoPath: normalizeOptionalString(content.selectionPhotoPath),
    messages: {
      welcomePrompt: content.messages?.welcomePrompt ?? "",
      subscribePrompt: content.messages?.subscribePrompt ?? "",
      subscribedPrompt: content.messages?.subscribedPrompt ?? "",
      deliveredPrefix: content.messages?.deliveredPrefix ?? "",
      unavailableGuide: content.messages?.unavailableGuide ?? "",
      subscriptionCheckError: content.messages?.subscriptionCheckError ?? "",
      checkSubscriptionButton: content.messages?.checkSubscriptionButton ?? "",
      channelButtonText: content.messages?.channelButtonText ?? ""
    },
    media: {
      welcomePhotoPath: normalizeOptionalString(content.media?.welcomePhotoPath),
      subscribePhotoPath: normalizeOptionalString(content.media?.subscribePhotoPath),
      subscriptionCheckErrorPhotoPath: normalizeOptionalString(content.media?.subscriptionCheckErrorPhotoPath),
      unavailableGuidePhotoPath: normalizeOptionalString(content.media?.unavailableGuidePhotoPath),
      deliveredPhotoPath: normalizeOptionalString(content.media?.deliveredPhotoPath)
    },
    guides: (content.guides ?? []).map(normalizeGuide).filter((guide) => guide.id || guide.title || guide.filePath)
  };
}

function normalizeGuide(guide: GuideBotAdminGuide): GuideBotAdminGuide {
  return {
    id: guide.id.trim(),
    title: guide.title.trim(),
    buttonPrefix: normalizeOptionalString(guide.buttonPrefix),
    filePath: guide.filePath.trim()
  };
}

function isPlaceholderContent(content: Partial<GuideBotAdminContent>, baseContent: GuideBotAdminContent): boolean {
  const normalized = normalizeAdminContent({
    ...baseContent,
    ...content,
    messages: {
      ...baseContent.messages,
      ...content.messages
    },
    media: {
      ...baseContent.media,
      ...content.media
    },
    guides: content.guides ?? []
  });

  return (
    normalized.guides.length === 0 &&
    Object.values(normalized.media).every((value) => !value) &&
    normalized.messages.welcomePrompt === baseContent.messages.welcomePrompt &&
    normalized.messages.subscribedPrompt === baseContent.messages.subscribedPrompt &&
    normalized.messages.subscribePrompt === baseContent.messages.subscribePrompt
  );
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function createSafeUploadName(fileName: string): string {
  const rawBase = basename(fileName || "upload.bin");
  const extension = extname(rawBase).toLowerCase();
  if (!allowedUploadExtensions.has(extension)) {
    throw new Error("Only jpg, png, webp, and pdf uploads are supported.");
  }

  const nameWithoutExtension = rawBase.slice(0, -extension.length);
  const safeBase = nameWithoutExtension.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
  return `${Date.now()}-${safeBase}${extension}`;
}
